import assert from 'node:assert/strict';
import test from 'node:test';

import { fetchTimersViaForge } from '../src/lib/forge-client';
import { calculateForgeContextTokenTtl } from '../src/lib/redis';

test('calculateForgeContextTokenTtl parses ISO expiresAt correctly', () => {
  const nowMs = Date.parse('2026-03-05T10:00:00.000Z');
  const expiresAtIso = '2026-03-05T10:10:00.000Z';

  const ttl = calculateForgeContextTokenTtl(expiresAtIso, {
    nowMs,
    maxTtlSeconds: 840,
    safetyBufferSeconds: 60,
  });

  // 10m to expiry - 60s safety buffer = 540s
  assert.equal(ttl, 540);
});

test('fetchTimersViaForge retries once without context token on access error', async () => {
  const originalFetch = global.fetch;
  let callCount = 0;
  const seenBodies: Array<Record<string, unknown>> = [];

  global.fetch = async (_url: string | URL | globalThis.Request, init?: RequestInit) => {
    callCount += 1;
    if (init?.body && typeof init.body === 'string') {
      seenBodies.push(JSON.parse(init.body) as Record<string, unknown>);
    }

    if (callCount === 1) {
      return {
        ok: true,
        json: async () => ({
          data: {
            invokeExtension: {
              success: false,
              errors: [{ message: 'User did not have access to specified resource(s)' }],
            },
          },
        }),
      } as Response;
    }

    return {
      ok: true,
      json: async () => ({
        data: {
          invokeExtension: {
            success: true,
            response: {
              body: {
                success: true,
                payload: {
                  status: 200,
                  body: {
                    timers: [{ id: 1, finished_at: null }],
                    total: 1,
                  },
                },
              },
            },
            contextToken: {
              jwt: 'fresh-token',
              expiresAt: '2026-03-05T10:20:00.000Z',
            },
          },
        },
      }),
    } as Response;
  };

  try {
    const result = await fetchTimersViaForge(
      'tenant-session',
      'example.atlassian.net',
      'cloud-id',
      'workspace-id',
      'stale-context-token',
      {},
    );

    assert.equal(callCount, 2);
    assert.equal(result.timers.length, 1);
    assert.equal(result.contextToken, 'fresh-token');

    const firstPayload = (
      (seenBodies[0].variables as Record<string, unknown>).input as Record<string, unknown>
    ).payload as Record<string, unknown>;
    const secondPayload = (
      (seenBodies[1].variables as Record<string, unknown>).input as Record<string, unknown>
    ).payload as Record<string, unknown>;

    assert.equal(firstPayload.contextToken, 'stale-context-token');
    assert.equal(secondPayload.contextToken, undefined);
  } finally {
    global.fetch = originalFetch;
  }
});
