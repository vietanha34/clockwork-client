import type { Timer } from './types';

export type TimerStatus = 'running' | 'on_hold' | 'stopped';

/**
 * Derive the timer status based on the timer state and working hours.
 *
 * - 'stopped' - No active timer
 * - 'running' - Timer is active and within working hours
 * - 'on_hold' - Timer is active but outside working hours
 */
export function getTimerStatus(timer: Timer | undefined | null): TimerStatus {
  if (!timer) {
    return 'stopped';
  }

  // If timer is within working hours, it's running
  if (timer.withinWorkingHours) {
    return 'running';
  }

  // Timer is active but outside working hours
  return 'on_hold';
}

/**
 * Get the display color for a timer status.
 */
export function getTimerStatusColor(status: TimerStatus): string {
  switch (status) {
    case 'running':
      return '#3b82f6'; // blue-500
    case 'on_hold':
      return '#f59e0b'; // amber-500
    case 'stopped':
      return '#6b7280'; // gray-500
    default:
      return '#6b7280';
  }
}
