# Tech Stack - Clockwork Menubar

## Languages

| Language | Version | Usage |
| --- | --- | --- |
| Rust | latest stable | Tauri backend, system tray, native APIs |
| TypeScript | 5.x | Tauri frontend (React), Vercel API, Inngest functions |

## Monorepo

| Tool | Purpose |
| --- | --- |
| Turborepo | Monorepo build orchestration, task caching, dependency management |
| pnpm | Package manager (recommended for Turborepo) |

## Frontend (Tauri App)

| Technology | Purpose |
| --- | --- |
| Tauri v2 | Cross-platform desktop framework (Rust core) |
| React | UI framework for Tauri webview |
| Vite | Build tool and dev server |

## Backend

| Technology | Purpose |
| --- | --- |
| Vercel | Serverless API hosting |
| Vercel API Routes | REST API endpoints (proxy for Clockwork & Atlassian APIs) |
| Inngest | Background job orchestration (timer data crawling & sync) |

## Database / Cache

| Technology | Purpose |
| --- | --- |
| Upstash Redis | Serverless Redis for caching active timer data |

## External APIs

| API | Purpose |
| --- | --- |
| Clockwork Pro API | Worklogs, timer start/stop |
| Clockwork Report API | Active timer data (via JWT) |
| Jira Servlet | JWT token exchange (cookie -> Clockwork JWT) |
| Atlassian REST API | Issue details, project information |

## Infrastructure

| Service | Purpose |
| --- | --- |
| Vercel | API & Inngest deployment |
| Upstash | Managed serverless Redis |
| GitHub | Source control, CI/CD |

## Key Dependencies (Planned)

### Tauri App
- `@tauri-apps/api` - Tauri JavaScript API
- `react`, `react-dom` - UI framework
- `@tanstack/react-query` - Data fetching & caching (candidate)

### Vercel API
- `@upstash/redis` - Redis client for Vercel edge
- `inngest` - Inngest SDK

### Inngest
- `inngest` - Inngest SDK for background functions
- `@upstash/redis` - Redis client
