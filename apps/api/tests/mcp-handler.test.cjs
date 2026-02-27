const test = require('node:test');
const assert = require('node:assert/strict');

const { createMcpMethodHandler } = require('../dist/src/lib/mcp-handler.js');

function makeRequest(method, params = {}, id = 1) {
  return {
    jsonrpc: '2.0',
    id,
    method,
    params,
  };
}

test('initialize returns server info and tools capability', async () => {
  const handler = createMcpMethodHandler({
    getActiveTimers: async () => null,
    getWorklogs: async () => [],
    searchIssues: async () => [],
  });

  const response = await handler(
    makeRequest('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '0.0.1' },
    }),
  );

  assert.equal(response.jsonrpc, '2.0');
  assert.equal(response.id, 1);
  assert.equal(response.result.protocolVersion, '2025-06-18');
  assert.equal(response.result.serverInfo.name, 'clockwork-mcp');
  assert.ok(response.result.capabilities.tools);
});

test('tools/list returns all expected tools', async () => {
  const handler = createMcpMethodHandler({
    getActiveTimers: async () => null,
    getWorklogs: async () => [],
    searchIssues: async () => [],
  });

  const response = await handler(makeRequest('tools/list'));
  const names = response.result.tools.map((tool) => tool.name).sort();

  assert.deepEqual(names, ['get_active_timers', 'get_all_active_timers', 'get_worklogs', 'search_issues']);
});

test('get_all_active_timers groups timers by account id', async () => {
  const handler = createMcpMethodHandler({
    getActiveTimers: async (userKey) => {
      assert.equal(userKey, 'all');
      return {
        timers: [
          { id: 1, runningFor: 'u1', author: { accountId: 'u1' } },
          { id: 2, runningFor: 'u1', author: { accountId: 'u1' } },
          { id: 3, runningFor: 'u2', author: { accountId: 'u2' } },
        ],
        cachedAt: '2026-02-27T00:00:00.000Z',
      };
    },
    getWorklogs: async () => [],
    searchIssues: async () => [],
  });

  const response = await handler(
    makeRequest('tools/call', {
      name: 'get_all_active_timers',
      arguments: {},
    }),
  );

  assert.equal(response.error, undefined);
  assert.equal(response.result.isError, undefined);
  assert.equal(response.result.structuredContent.total_accounts, 2);
  assert.equal(response.result.structuredContent.total_timers, 3);
  assert.deepEqual(
    response.result.structuredContent.timers_by_account_id.map((item) => item.account_id),
    ['u1', 'u2'],
  );
  assert.equal(response.result.structuredContent.timers_by_account_id[0].timers.length, 2);
  assert.equal(response.result.structuredContent.timers_by_account_id[1].timers.length, 1);
});

test('tools/call returns method error for unknown tool', async () => {
  const handler = createMcpMethodHandler({
    getActiveTimers: async () => null,
    getWorklogs: async () => [],
    searchIssues: async () => [],
  });

  const response = await handler(
    makeRequest('tools/call', {
      name: 'unknown_tool',
      arguments: {},
    }),
  );

  assert.equal(response.error.code, -32601);
});
