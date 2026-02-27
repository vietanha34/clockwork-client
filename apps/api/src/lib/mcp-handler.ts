import { getWorklogs } from './clockwork-client';
import { getActiveTimers } from './redis';
import { searchIssues } from './atlassian-client';
import type { Issue, Worklog } from './types';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: JsonRpcError;
}

interface McpToolResult {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: unknown;
  isError?: boolean;
}

interface ToolDescriptor {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

export interface McpDependencies {
  getActiveTimers: typeof getActiveTimers;
  getWorklogs: typeof getWorklogs;
  searchIssues: typeof searchIssues;
}

const DEFAULT_DEPENDENCIES: McpDependencies = {
  getActiveTimers,
  getWorklogs,
  searchIssues,
};

const SUPPORTED_PROTOCOL_VERSIONS = new Set(['2025-06-18', '2024-11-05']);

const TOOLS: ToolDescriptor[] = [
  {
    name: 'get_active_timers',
    description: 'Get active timers for a specific Jira account id.',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: { type: 'string', description: 'Atlassian account id.' },
      },
      required: ['account_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_worklogs',
    description: 'Get worklogs for an account id in a date range (inclusive).',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: { type: 'string', description: 'Atlassian account id.' },
        from_date: { type: 'string', description: 'Start date YYYY-MM-DD.' },
        to_date: { type: 'string', description: 'End date YYYY-MM-DD.' },
      },
      required: ['account_id', 'from_date', 'to_date'],
      additionalProperties: false,
    },
  },
  {
    name: 'search_issues',
    description: 'Search Jira issues by key or text query.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Issue key or free text query.' },
        max_results: {
          type: 'number',
          description: 'Maximum returned issues (1-10). Optional, default 10.',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
];

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function createError(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      ...(data === undefined ? {} : { data }),
    },
  };
}

function createResult(id: string | number | null, result: unknown): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id,
    result,
  };
}

function ensureRequestShape(payload: unknown): payload is JsonRpcRequest {
  if (!payload || typeof payload !== 'object') return false;
  const candidate = payload as Record<string, unknown>;
  return candidate.jsonrpc === '2.0' && typeof candidate.method === 'string';
}

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0] ?? '';
}

function escapeJqlValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

async function callGetActiveTimers(
  deps: McpDependencies,
  args: Record<string, unknown>,
): Promise<McpToolResult> {
  const accountId = typeof args.account_id === 'string' ? args.account_id.trim() : '';
  if (!accountId) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'Missing required argument: account_id' }],
    };
  }

  const cached = await deps.getActiveTimers(accountId);
  const payload = {
    account_id: accountId,
    timers: cached?.timers ?? [],
    cached_at: cached?.cachedAt ?? null,
  };

  return {
    content: [{ type: 'text', text: safeStringify(payload) }],
    structuredContent: payload,
  };
}

async function callGetWorklogs(
  deps: McpDependencies,
  args: Record<string, unknown>,
): Promise<McpToolResult> {
  const accountId = typeof args.account_id === 'string' ? args.account_id.trim() : '';
  const fromDate = typeof args.from_date === 'string' ? args.from_date.trim() : '';
  const toDate = typeof args.to_date === 'string' ? args.to_date.trim() : '';

  if (!accountId || !fromDate || !toDate) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'Missing required arguments: account_id, from_date, to_date' }],
    };
  }

  const from = parseDate(fromDate);
  const to = parseDate(toDate);

  if (!from || !to) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'Invalid date format. Expected YYYY-MM-DD.' }],
    };
  }

  if (from.getTime() > to.getTime()) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'from_date must be <= to_date.' }],
    };
  }

  const daySpan = Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;
  if (daySpan > 31) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'Date range too large. Maximum 31 days.' }],
    };
  }

  const allWorklogs: Worklog[] = [];
  for (let cursor = new Date(from); cursor.getTime() <= to.getTime(); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const targetDate = formatDate(cursor);
    const worklogs = await deps.getWorklogs(accountId, targetDate);
    allWorklogs.push(...worklogs);
  }

  const totalSeconds = allWorklogs.reduce((sum, worklog) => sum + worklog.timeSpentSeconds, 0);
  const payload = {
    account_id: accountId,
    from_date: fromDate,
    to_date: toDate,
    total_seconds: totalSeconds,
    worklogs: allWorklogs,
  };

  return {
    content: [{ type: 'text', text: safeStringify(payload) }],
    structuredContent: payload,
  };
}

async function callSearchIssues(
  deps: McpDependencies,
  args: Record<string, unknown>,
): Promise<McpToolResult> {
  const query = typeof args.query === 'string' ? args.query.trim() : '';
  const rawMaxResults = args.max_results;

  if (!query) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'Missing required argument: query' }],
    };
  }

  const parsedMaxResults =
    typeof rawMaxResults === 'number'
      ? rawMaxResults
      : (typeof rawMaxResults === 'string' ? Number.parseInt(rawMaxResults, 10) : Number.NaN);

  const maxResults = Number.isFinite(parsedMaxResults)
    ? Math.min(Math.max(Number(parsedMaxResults), 1), 10)
    : 10;

  const escapedQuery = escapeJqlValue(query);
  const uppercaseQuery = escapedQuery.toUpperCase();
  const jql = `(issuekey = "${uppercaseQuery}" OR text ~ "${escapedQuery}" OR summary ~ "${escapedQuery}") ORDER BY updated DESC`;

  const issues: Issue[] = await deps.searchIssues(jql, maxResults);
  const payload = {
    query,
    max_results: maxResults,
    total: issues.length,
    issues,
  };

  return {
    content: [{ type: 'text', text: safeStringify(payload) }],
    structuredContent: payload,
  };
}

export function createMcpMethodHandler(deps: McpDependencies = DEFAULT_DEPENDENCIES) {
  return async function handleMcpRequest(payload: unknown): Promise<JsonRpcResponse | null> {
    if (!ensureRequestShape(payload)) {
      return createError(null, -32600, 'Invalid Request');
    }

    const id = payload.id ?? null;
    const params = payload.params ?? {};

    if (typeof params !== 'object' || Array.isArray(params) || params === null) {
      return createError(id, -32602, 'Invalid params');
    }

    // Notifications have no id; return no response body for those calls.
    if (payload.id === undefined && payload.method.startsWith('notifications/')) {
      return null;
    }

    try {
      switch (payload.method) {
        case 'initialize': {
          const requestedVersion = typeof params.protocolVersion === 'string'
            ? params.protocolVersion
            : '2025-06-18';
          const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.has(requestedVersion)
            ? requestedVersion
            : '2025-06-18';

          return createResult(id, {
            protocolVersion,
            capabilities: {
              tools: {
                listChanged: false,
              },
            },
            serverInfo: {
              name: 'clockwork-mcp',
              version: '0.1.0',
            },
          });
        }

        case 'tools/list':
          return createResult(id, { tools: TOOLS });

        case 'tools/call': {
          const toolName = typeof params.name === 'string' ? params.name : '';
          const args =
            params.arguments && typeof params.arguments === 'object' && !Array.isArray(params.arguments)
              ? params.arguments as Record<string, unknown>
              : {};

          let toolResult: McpToolResult;
          if (toolName === 'get_active_timers') {
            toolResult = await callGetActiveTimers(deps, args);
          } else if (toolName === 'get_worklogs') {
            toolResult = await callGetWorklogs(deps, args);
          } else if (toolName === 'search_issues') {
            toolResult = await callSearchIssues(deps, args);
          } else {
            return createError(id, -32601, `Tool not found: ${toolName}`);
          }

          return createResult(id, toolResult);
        }

        case 'ping':
          return createResult(id, {});

        default:
          return createError(id, -32601, `Method not found: ${payload.method}`);
      }
    } catch (error) {
      return createError(
        id,
        -32603,
        'Internal error',
        { detail: error instanceof Error ? error.message : String(error) },
      );
    }
  };
}
