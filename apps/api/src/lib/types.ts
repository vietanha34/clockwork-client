// ─── Clockwork Pro API Types ─────────────────────────────────────────────────

export interface ClockworkUser {
  accountId: string;
  emailAddress?: string;
  displayName?: string;
  avatarUrl?: string;
}

export interface Timer {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  comment: string | null;
  runningFor: string;
  tillNow: number; // seconds elapsed
  worklogCount: number;
  issue: TimerIssueRef;
  author?: ClockworkUser;
}

export interface TimerIssueRef {
  key: string;
  id: number;
}

export interface Worklog {
  id: number;
  issueKey?: string;
  issueName?: string;
  projectName?: string;
  issueId: number;
  timeSpentSeconds: number;
  started: string;
  comment: string | null;
  author: ClockworkUser;
}

// ─── Atlassian / Jira Types ───────────────────────────────────────────────────

export interface Issue {
  key: string;
  id: string;
  summary: string;
  status: string;
  project: Project;
  assignee: ClockworkUser | null;
  priority: string | null;
  url: string;
}

export interface Project {
  id: string;
  key: string;
  name: string;
  avatarUrl?: string;
}

// ─── API Response Types ───────────────────────────────────────────────────────

export interface ActiveTimersResponse {
  timers: Timer[];
  cachedAt: string | null;
  accountId: string;
}

export interface WorklogsResponse {
  worklogs: Worklog[];
  total: number;
  date: string;
  accountId: string;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

// ─── Clockwork Report API (raw) ───────────────────────────────────────────────

export interface RawClockworkTimer {
  id: number;
  started_at: string;
  finished_at: string | null;
  error_messages: string[] | null;
  running_for: string;
  comment: string | null;
  started_within_working_hours: boolean | null;
  within_working_hours: boolean | null;
  issue: { key: string; id: number };
  till_now: number;
  worklog_count: number;
  author?: {
    accountId: string;
    displayName: string;
    emailAddress?: string;
    avatarUrl?: string;
  };
}

export interface RawClockworkTimersResponse {
  timers: RawClockworkTimer[];
  startAt: number;
  maxResults: number;
  total: number;
  isLast: boolean;
  page: number;
  pages: number;
  isFirst: boolean;
}

// ─── Redis Cache ──────────────────────────────────────────────────────────────

export interface CachedTimerData {
  timers: Timer[];
  cachedAt: string;
  userKey: string;
}
