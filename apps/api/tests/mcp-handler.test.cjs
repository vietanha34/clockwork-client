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

  assert.deepEqual(names, ['get_active_timers', 'get_worklogs', 'search_issues']);
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
