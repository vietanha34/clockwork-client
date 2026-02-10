# Product Guidelines - Clockwork Menubar

## Voice and Tone

**Concise and direct.** Minimal text, clear labels, developer-friendly. Focus on information density. Every word in the UI should earn its place.

## Design Principles

### 1. Performance First
- Lightweight process with minimal memory and CPU footprint
- Fast startup time - the app should be ready within seconds
- Efficient polling and caching strategies for timer data
- No unnecessary background processing

### 2. Simplicity Over Features
- Do a few things exceptionally well
- Avoid feature bloat - the menu bar popup should show essential info at a glance
- Clear, uncluttered UI with purposeful information hierarchy
- One-click actions for common operations (start/stop timer)

## UI Guidelines

- Menu bar / system tray icon should be monochrome and follow OS conventions
- Popup window should be compact and scannable
- Use system-native fonts and colors where possible
- Timer display should be prominent and always visible
- Worklog list should be scrollable but not overwhelming

## Error Handling

- Show inline, non-blocking error messages
- Gracefully handle network failures with cached data
- Clear indication when data is stale or connection is lost
