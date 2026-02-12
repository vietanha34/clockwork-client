// ─── Clockwork / Jira Types ───────────────────────────────────────────────────

export interface ClockworkUser {
  accountId: string;
  emailAddress: string;
  displayName: string;
  avatarUrl?: string;
}

export interface TimerIssueRef {
  key: string;
  id: number;
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
}

export interface Worklog {
  id: number;
  issueKey: string;
  issueId: number;
  timeSpentSeconds: number;
  started: string;
  comment: string | null;
  author: ClockworkUser;
}

export interface Project {
  id: string;
  key: string;
  name: string;
  avatarUrl?: string;
}

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

// ─── App Settings ─────────────────────────────────────────────────────────────

export interface AppSettings {
  jiraToken: string;
}
