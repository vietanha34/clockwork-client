# Workflow - Clockwork Menubar

## TDD Policy

**Flexible** - Tests recommended for complex logic only.

- Write tests for API route handlers and data transformation logic
- Tests encouraged but not blocking for UI components
- Integration tests for critical paths (timer start/stop, data sync)
- No strict test-first requirement

## Commit Strategy

**Conventional Commits** format required:

```
feat: add timer display component
fix: correct worklog time calculation
chore: update dependencies
refactor: extract API client module
docs: add setup instructions
```

### Scope Conventions
- `feat(tauri):` - Tauri desktop app changes
- `feat(api):` - Vercel API changes
- `feat(inngest):` - Inngest function changes
- `chore(repo):` - Monorepo/tooling changes

## Code Review

**Optional / self-review OK** - This is a personal project. Self-review before merging is sufficient.

## Verification Checkpoints

**After each phase completion:**
- Verify the phase deliverables work as expected
- Run any existing tests
- Manual testing of new functionality
- Confirm no regressions in existing features

## Task Lifecycle

1. **Pending** - Task created, not yet started
2. **In Progress** - Actively being worked on
3. **Completed** - Work done, verified, committed

## Branch Strategy

- `main` - Stable, deployable code
- `feat/<track-id>-<short-name>` - Feature branches per track
- Merge to main after track completion and verification

## Development Flow

1. Pick up a task from the current track phase
2. Create/switch to feature branch if needed
3. Implement the change
4. Write tests if applicable (complex logic)
5. Self-review the changes
6. Commit with conventional commit message
7. Mark task as completed
8. At phase end: verify all phase deliverables
