# Product Definition - Clockwork Menubar

## Overview

**Project Name:** Clockwork Menubar

**Description:** A cross-platform menu bar / system tray app that displays Clockwork Pro timer status and worklogs from Jira, with a Vercel backend proxy and Inngest-powered data sync.

## Problem Statement

Users have to open Jira in a browser tab to check their Clockwork Pro timer status and worklogs, causing context-switching and friction in daily time tracking.

## Target Users

Any Jira user with Clockwork Pro who wants a native desktop experience.

## Key Goals

1. Provide real-time timer visibility in the menu bar
2. Enable timer start/stop without leaving the desktop
3. Show daily worklog summary at a glance

## Core Features

### Client (Tauri Desktop App)
- User enters their Jira email address for Clockwork Pro integration
- Menu bar / system tray icon displays active Clockwork Pro timer info:
  - Timer start time
  - Elapsed time (running duration)
  - Associated work item (issue key)
  - Project of the work item
- Daily worklog summary panel:
  - Total worklog time for the day
  - List of individual worklogs
- Timer controls:
  - Stop currently running timer
  - Start a new timer
- Cross-platform: macOS (menu bar), Windows & Linux (system tray)

### Backend (Vercel API)
- Proxy API for Clockwork Pro operations:
  - Worklog listing via Clockwork API
  - Timer start/stop via Clockwork API
- Proxy for Atlassian API:
  - Issue details
  - Project information
- Active timer data crawling (via Inngest):
  - JWT token acquisition from Jira servlet
  - Real-time timer data from Clockwork Report API
  - Cached in Redis (Upstash) for fast retrieval

### Architecture
- Monorepo with Turborepo, containing 3 apps:
  1. `tauri` - Rust/React desktop client
  2. `api` - Vercel serverless API routes
  3. `inngest` - Inngest background functions for timer data sync

## Active Timer Data Flow

1. **ENV Setup:** `JIRA_FULL_COOKIE` and `JIRA_DOMAIN` (e.g., `vietanha34.atlassian.net`)
2. **JWT Acquisition:** POST to Jira servlet endpoint to exchange Jira cookie for Clockwork JWT
3. **Timer Query:** GET `timers.json` from Clockwork Report API using JWT
4. **Cache:** Store results in Upstash Redis for fast client retrieval
