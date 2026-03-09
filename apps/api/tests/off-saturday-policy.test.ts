import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getStartOfVnDayEpochMs,
  isInVnTimeWindow,
  parseClockTimeToMinutes,
  shouldRunOffSaturdayCleanup,
} from '../src/lib/off-saturday-policy';

test('shouldRunOffSaturdayCleanup marks 2026-03-07 as off Saturday for even parity', () => {
  const now = new Date('2026-03-07T05:10:00.000Z'); // 12:10 VN
  const result = shouldRunOffSaturdayCleanup(now, 'even');

  assert.equal(result.isSaturday, true);
  assert.equal(result.isoWeek, 10);
  assert.equal(result.isOffSaturday, true);
  assert.equal(result.vnDate, '2026-03-07');
});

test('shouldRunOffSaturdayCleanup skips 2026-03-14 for even parity', () => {
  const now = new Date('2026-03-14T05:10:00.000Z'); // 12:10 VN
  const result = shouldRunOffSaturdayCleanup(now, 'even');

  assert.equal(result.isSaturday, true);
  assert.equal(result.isoWeek, 11);
  assert.equal(result.isOffSaturday, false);
  assert.equal(result.vnDate, '2026-03-14');
});

test('isInVnTimeWindow uses start-inclusive and end-exclusive semantics', () => {
  const start = parseClockTimeToMinutes('08:00');
  const end = parseClockTimeToMinutes('12:00');

  assert.equal(isInVnTimeWindow('2026-03-07T08:00:00.000+0700', start, end), true);
  assert.equal(isInVnTimeWindow('2026-03-07T11:59:59.000+0700', start, end), true);
  assert.equal(isInVnTimeWindow('2026-03-07T12:00:00.000+0700', start, end), false);
  assert.equal(isInVnTimeWindow('2026-03-07T07:59:59.000+0700', start, end), false);
});

test('getStartOfVnDayEpochMs converts VN 00:00 correctly', () => {
  const now = new Date('2026-03-07T05:10:00.000Z'); // 12:10 VN
  const sinceMs = getStartOfVnDayEpochMs(now);

  assert.equal(new Date(sinceMs).toISOString(), '2026-03-06T17:00:00.000Z');
});
