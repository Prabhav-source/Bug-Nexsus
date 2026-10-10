# BUGNEXUS 2.0 — Bug Tracking & Developer Intelligence

A full-stack bug tracking platform built for engineering teams, featuring an AI-assisted
workflow, real-time Kanban boards, and developer-intelligence dashboards. Styled with the
"Crimson After Dark" dark design system.

## Architecture

```
bugnexus/
├── server/              # Express + TypeScript + Prisma + SQLite API
│   ├── src/
│   │   ├── config/      # Environment validation (Zod)
│   │   ├── lib/         # Prisma client, auth (JWT/bcrypt), errors, validation (Zod), AI provider
│   │   ├── middleware/  # Error handler, async wrapper, request validation
│   │   ├── services/    # Issue, analytics, AI, workspace, activity services
│   │   ├── routes/      # REST API route modules
│   │   ├── types/       # Express Request augmentation
│   │   ├── app.ts       # Express application factory
│   │   └── index.ts     # Server entry point
│   └── prisma/
│       ├── schema.prisma
│       └── seed.ts
├── web/                 # React 18 + Vite + Tailwind frontend
│   ├── src/
│   │   ├── api/         # Axios client with auth interceptors
│   │   ├── components/  # Reusable UI kit (Button, Card, Badge, …)
│   │   ├── context/     # AuthProvider + AuthContext
│   │   ├── layout/      # AppShell, Sidebar, TopNav, CommandPalette
│   │   ├── pages/       # Dashboard, Issues, Board, Projects, Analytics, …
│   │   └── lib/         # TypeScript types & design-system helpers
│   └── index.html
├── package.json         # Root workspace orchestration
├── .env.example
└── AGENTS.md
```

## Prerequisites

- Node.js >= 20
- npm 10+ (or npm 8+ with workspaces)

## Getting Started

```bash
# Install dependencies (run once)
npm install

# Server: set up the database
npm run db:push     # creates server/prisma/dev.db from schema
npm run db:seed     # seeds with demo data

# Start the API server
npm run dev:server

# In a separate terminal, start the frontend
npm run dev:web
```

This starts:
- **API server** at `http://localhost:4000`
- **Frontend** at `http://localhost:5173` (proxies `/api` to the server)

## Demo Credentials

All seeded users use the password `devpassword123`:

| Email                | Name          | Role  |
|----------------------|---------------|-------|
| ava@bugnexus.dev     | Ava Chen      | Owner |
| marcus@bugnexus.dev  | Marcus Webb   | Admin |
| priya@bugnexus.dev   | Priya Sharma  | Member|
| diego@bugnexus.dev   | Diego Torres  | Member|
| lena@bugnexus.dev    | Lena Fischer  | Member|
| sam@bugnexus.dev     | Sam Okafor    | Member|
| yuki@bugnexus.dev    | Yuki Tanaka   | Member|
| noah@bugnexus.dev    | Noah Williams | Member|

Alternatively, register a new account at `/register`.

## API Overview

All endpoints are prefixed with `/api/`. Authentication uses a JWT bearer token
(also persisted to an httpOnly cookie).

| Endpoint                              | Method | Auth | Description                  |
|---------------------------------------|--------|------|------------------------------|
| `/api/auth/register`                  | POST   | —    | Register + create workspace  |
| `/api/auth/login`                     | POST   | —    | Login, returns token         |
| `/api/auth/logout`                    | POST   | ✓    | Clear session                |
| `/api/auth/me`                        | GET    | ✓    | Current user + workspaces    |
| `/api/workspaces`                     | GET    | ✓    | List workspaces              |
| `/api/projects`                       | GET    | ✓    | List projects                |
| `/api/projects`                       | POST   | ✓    | Create project               |
| `/api/projects/:id`                   | GET    | ✓    | Project detail               |
| `/api/projects/:id/issues`            | GET    | ✓    | Issues in a project          |
| `/api/issues`                         | GET    | ✓    | List issues (filterable)     |
| `/api/issues`                         | POST   | ✓    | Create issue                 |
| `/api/issues/:id`                     | GET    | ✓    | Issue detail                 |
| `/api/issues/:id`                     | PATCH  | ✓    | Update issue fields          |
| `/api/issues/:id/status`              | POST   | ✓    | Change status                |
| `/api/issues/:id/severity`            | POST   | ✓    | Change severity              |
| `/api/issues/:id/assign`              | POST   | ✓    | Assign/unassign              |
| `/api/issues/:id/comments`            | POST   | ✓    | Add comment                  |
| `/api/issues/:id/related`             | POST   | ✓    | Link related issue           |
| `/api/issues/:id/archive`             | POST   | ✓    | Archive issue                |
| `/api/issues/:id/activity`            | GET    | ✓    | Issue activity timeline      |
| `/api/sprints`                        | GET    | ✓    | List sprints                 |
| `/api/sprints`                        | POST   | ✓    | Create sprint                |
| `/api/developers`                     | GET    | ✓    | Team members + workload      |
| `/api/developers/:id`                 | GET    | ✓    | Developer detail + open issues|
| `/api/activity`                       | GET    | ✓    | Workspace activity feed      |
| `/api/notifications`                  | GET    | ✓    | List notifications           |
| `/api/notifications/unread-count`     | GET    | ✓    | Unread count                 |
| `/api/notifications/:id/read`         | PATCH  | ✓    | Mark read                    |
| `/api/notifications/read-all`         | POST   | ✓    | Mark all read                |
| `/api/analytics/overview`             | GET    | ✓    | Dashboard metrics            |
| `/api/analytics/activity-trend`       | GET    | ✓    | Opened/resolved trend        |
| `/api/analytics/severity-distribution`| GET    | ✓    | Severity counts              |
| `/api/analytics/project-health`       | GET    | ✓    | Per-project health scores    |
| `/api/analytics/resolution-trends`    | GET    | ✓    | Resolution by severity       |
| `/api/analytics/team-workload`        | GET    | ✓    | Per-developer workload       |
| `/api/analytics/needs-attention`      | GET    | ✓    | Issues needing attention     |
| `/api/search?q=`                      | GET    | ✓    | Global search                |
| `/api/labels`                         | GET/POST | ✓   | Manage labels                |
| `/api/ai/config`                      | GET    | ✓    | AI provider status           |
| `/api/ai/summarize`                   | POST   | ✓    | Summarize an existing issue  |
| `/api/ai/improve`                     | POST   | ✓    | Improve rough report text    |
| `/api/ai/severity-suggest`            | POST   | ✓    | Suggest severity (new issue) |
| `/api/ai/debug-steps`                 | POST   | ✓    | Suggest debugging steps      |
| `/api/ai/duplicates/:issueId`         | GET    | ✓    | Find duplicate issues        |
| `/api/health`                         | GET    | —    | Liveness check               |

### Example: list issues filtered by severity

```
GET /api/issues?severity=HIGH,CRITICAL&status=OPEN&sort=severity&order=desc&page=1&limit=20
```

### Example: change issue status

```
POST /api/issues/:id/status
{ "status": "IN_PROGRESS" }
```

## Environment Variables

See `.env.example`. Key variables:

| Variable                | Default             | Description                          |
|-------------------------|---------------------|--------------------------------------|
| `PORT`                  | `4000`              | API server port                      |
| `CLIENT_URL`            | `http://localhost:5173` | Frontend origin (CORS)          |
| `JWT_SECRET`            | *(required)*        | JWT signing secret                   |
| `JWT_EXPIRES_IN`        | `7d`                | Token expiry                         |
| `DATABASE_URL`          | `file:./dev.db`     | SQLite connection string             |
| `AI_PROVIDER`           | `rule-based`        | `rule-based` (offline) or `openai`   |
| `OPENAI_API_KEY`        | *(empty)*           | OpenAI API key (optional)            |
| `OPENAI_MODEL`          | `gpt-4o-mini`       | OpenAI model                         |

## Data Model

The Prisma schema (`server/prisma/schema.prisma`) defines these models.
Enum-like fields (severity, status, etc.) are stored as `String` with defaults,
validated by Zod at the API layer, since SQLite does not support native enums.

**Workspace** → **Project** → **Issue** → **Comment / ActivityEvent / Label**
Sprints group issues. Users have workspace + project memberships with roles.

**Issue key format:** `<PREFIX>-<n>` (e.g. `NEXUS-1`, `WEB-7`), derived from the
project's first word.

## Project Health Score

A transparent 0–100 score per project to surface risk (see
`server/src/services/analyticsService.ts`):

- **Base:** 100
- **−15** per unresolved CRITICAL issue (max −45)
- **−5** per overdue unresolved issue (max −25)
- **−10** if the backlog grew over the last 14 days
- **+10** if resolutions exceeded openings in the last 7 days (max +10)
- Clamped to [0, 100]
- Labels: `HEALTHY` (≥70), `NEEDS_ATTENTION` (40–69), `AT_RISK` (<40)

## AI Assistant

BUGNEXUS ships with a **rule-based AI provider** that works offline with zero
configuration. It provides severity suggestions (keyword scoring), issue
summaries (extractive), text improvement, debug-step generation, and duplicate
detection (Jaccard similarity).

To use OpenAI instead, set in `server/.env`:

```
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

All AI output is a **suggestion** with a disclaimer — never auto-applied.

## Development

```bash
# Run everything (server + web, concurrently)
npm run dev

# Server only
npm run dev:server

# Web only
npm run dev:web

# Database
npm run db:push    # apply schema changes
npm run db:seed    # seed demo data
npm run db:studio  # open Prisma Studio

# Tests
npm test

# Production build
npm run build
npm start
```

## License

MIT
