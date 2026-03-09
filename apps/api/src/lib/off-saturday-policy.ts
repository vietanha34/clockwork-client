export type WeekParity = 'even' | 'odd';

interface VnDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const MINUTES_PER_DAY = 24 * 60;

function getVnDateParts(input: Date | string): VnDateParts {
  const date = typeof input === 'string' ? new Date(input) : input;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(byType.year),
    month: Number(byType.month),
    day: Number(byType.day),
    hour: Number(byType.hour),
    minute: Number(byType.minute),
  };
}

export function getVnDateString(input: Date | string): string {
  const parts = getVnDateParts(input);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function parseClockTimeToMinutes(clockTime: string): number {
  const match = clockTime.match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid time format: ${clockTime}. Expected HH:MM`);
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error(`Invalid time value: ${clockTime}`);
  }

  return hour * 60 + minute;
}

export function getVnMinutesInDay(input: Date | string): number {
  const parts = getVnDateParts(input);
  return parts.hour * 60 + parts.minute;
}

function getIsoWeekFromDateParts(year: number, month: number, day: number): number {
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayNum = date.getUTCDay() || 7; // Monday=1 ... Sunday=7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function isSaturdayFromDateParts(year: number, month: number, day: number): boolean {
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return dayOfWeek === 6;
}

export function shouldRunOffSaturdayCleanup(
  now: Date,
  parity: WeekParity,
): {
  isSaturday: boolean;
  isoWeek: number;
  isOffSaturday: boolean;
  vnDate: string;
} {
  const parts = getVnDateParts(now);
  const isoWeek = getIsoWeekFromDateParts(parts.year, parts.month, parts.day);
  const isSaturday = isSaturdayFromDateParts(parts.year, parts.month, parts.day);
  const isOffSaturday = parity === 'even' ? isoWeek % 2 === 0 : isoWeek % 2 === 1;

  return {
    isSaturday,
    isoWeek,
    isOffSaturday,
    vnDate: `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`,
  };
}

export function isInVnTimeWindow(
  input: Date | string,
  startMinutes: number,
  endMinutes: number,
): boolean {
  if (startMinutes < 0 || endMinutes > MINUTES_PER_DAY || endMinutes <= startMinutes) {
    throw new Error(
      `Invalid time window: start=${startMinutes}, end=${endMinutes}. Expected 0<=start<end<=1440`,
    );
  }

  const minuteOfDay = getVnMinutesInDay(input);
  return minuteOfDay >= startMinutes && minuteOfDay < endMinutes;
}

export function getStartOfVnDayEpochMs(now: Date): number {
  const parts = getVnDateParts(now);
  // 00:00 in VN is previous day 17:00 UTC
  return Date.UTC(parts.year, parts.month - 1, parts.day, 0 - 7, 0, 0, 0);
}
