# TypeScript Style Guide - Clockwork Menubar

## General

- Use TypeScript strict mode (`"strict": true` in tsconfig)
- Prefer `const` over `let`; never use `var`
- Use explicit return types for exported functions
- Use `unknown` over `any` where possible

## Naming Conventions

| Entity | Convention | Example |
| --- | --- | --- |
| Variables / Functions | camelCase | `getActiveTimer`, `worklogList` |
| Types / Interfaces | PascalCase | `TimerResponse`, `WorklogEntry` |
| Constants | UPPER_SNAKE_CASE | `API_BASE_URL`, `MAX_RETRY_COUNT` |
| Files | kebab-case | `timer-service.ts`, `worklog-panel.tsx` |
| React Components | PascalCase files | `TimerDisplay.tsx`, `WorklogList.tsx` |
| Enums | PascalCase (members too) | `TimerStatus.Running` |

## Imports

- Use named imports over default imports where possible
- Group imports: external libs > internal modules > relative imports
- Use path aliases (`@/`) for internal imports in each app

## Types

- Prefer `interface` for object shapes that may be extended
- Prefer `type` for unions, intersections, and utility types
- Co-locate types with their usage; extract to `types/` only when shared across modules
- Use `z.infer<typeof schema>` with Zod for API response types

## React (Tauri Frontend)

- Functional components only
- Use named exports for components
- Props interface named `{ComponentName}Props`
- Keep components small and focused
- Extract hooks for data fetching and state logic

```typescript
// Good
interface TimerDisplayProps {
  timer: ActiveTimer;
  onStop: () => void;
}

export function TimerDisplay({ timer, onStop }: TimerDisplayProps) {
  // ...
}
```

## API Routes (Vercel)

- One route per file
- Validate request body/params at the boundary
- Return consistent response shapes
- Use proper HTTP status codes

```typescript
// api/timers/active.ts
export async function GET(request: Request) {
  // validate, fetch, return
}
```

## Error Handling

- Use typed error responses at API boundaries
- Avoid swallowing errors silently
- Log errors with context (user action, endpoint, params)

## Async

- Always `await` promises; avoid fire-and-forget unless intentional
- Use `Promise.all` for independent concurrent operations
- Handle rejections explicitly
