import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createMcpMethodHandler } from '../src/lib/mcp-handler';

const mcpHandler = createMcpMethodHandler();

function getAllowedOrigins(): string[] {
  const raw = process.env.MCP_ALLOWED_ORIGINS ?? '';
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  const allowList = getAllowedOrigins();
  if (allowList.length === 0) return true;
  if (allowList.includes('*')) return true;
  return allowList.includes(origin);
}

function setCorsHeaders(req: VercelRequest, res: VercelResponse): void {
  const origin = req.headers.origin;
  const allowList = getAllowedOrigins();

  if (origin && isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else if (!origin && allowList.length === 0) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
}

function hasValidApiKey(req: VercelRequest): boolean {
  const expected = process.env.MCP_API_KEY;
  if (!expected) return true;

  const xApiKey = req.headers['x-api-key'];
  const authHeader = req.headers.authorization;
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';

  if (typeof xApiKey === 'string' && xApiKey === expected) return true;
  if (Array.isArray(xApiKey) && xApiKey.includes(expected)) return true;
  if (bearer === expected) return true;
  return false;
}

function parsePayload(req: VercelRequest): unknown {
  if (typeof req.body === 'string') {
    return JSON.parse(req.body);
  }

  if (req.body === undefined || req.body === null) {
    return null;
  }

  return req.body;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  setCorsHeaders(req, res);

  if (!isOriginAllowed(req.headers.origin)) {
    res.status(403).json({ error: 'ORIGIN_NOT_ALLOWED' });
    return;
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (!hasValidApiKey(req)) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid MCP API key.' });
    return;
  }

  if (req.method === 'GET') {
    res.status(200).json({
      name: 'clockwork-mcp',
      transport: 'streamable-http',
      endpoint: '/api/mcp',
      usage: 'POST JSON-RPC requests to this endpoint.',
    });
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET,POST,OPTIONS');
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  let payload: unknown;
  try {
    payload = parsePayload(req);
  } catch {
    res.status(400).json({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32700,
        message: 'Parse error',
      },
    });
    return;
  }

  if (Array.isArray(payload)) {
    if (payload.length === 0) {
      res.status(400).json({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32600, message: 'Invalid Request' },
      });
      return;
    }

    const responses = await Promise.all(payload.map((item) => mcpHandler(item)));
    const filtered = responses.filter((item): item is NonNullable<typeof item> => item !== null);

    if (filtered.length === 0) {
      res.status(202).end();
      return;
    }

    res.status(200).json(filtered);
    return;
  }

  const response = await mcpHandler(payload);
  if (!response) {
    res.status(202).end();
    return;
  }

  res.status(200).json(response);
}
