# BUGNEXUS 2.0 — Project Status

## Status: Complete & Verified

Full-stack bug tracking & developer-intelligence platform with the "Crimson After Dark"
design system. Both web and server workspaces build cleanly, all tests pass, and the app
is verified end-to-end (frontend proxy → API → database).

## What's Done

### Server (`server/`)
- **Framework:** Express + TypeScript, Prisma ORM, SQLite, JWT/Bcrypt auth, Zod validation
- **Models:** 15 Prisma models (User, Workspace, Project, Issue, Sprint, Label, Comment,
  ActivityEvent, Notification, IssueRelation, IssueLabel, AttachmentMetadata, etc.)
- **Endpoints:** 30+ REST routes covering auth, workspaces, projects, issues, sprints,
  developers, activity, notifications, analytics, search, labels, and AI
- **AI:** Provider abstraction — rule-based (offline, default) + optional OpenAI-compatible
- **Analytics:** Dashboard overview, project health score (0-100, documented formula),
  activity trends, severity distribution, team workload, needs-attention
- **Quality:** `tsc` clean, 37 tests passing (~4s), seed data with 8 users / 4 projects /
  26+ issues / comments / activity / notifications
- **Known fixes during dev:** SQLite doesn't support Prisma enums (→ String fields),
  `mode: 'insensitive'` unsupported (→ removed; SQLite LIKE is ASCII-case-insensitive),
  `createMany(skipDuplicates)` unsupported on SQLite (→ loop + per-row create),
  clean issue keys (`NEXUS-9`, not `NEXUSAPIXXXX-9`), fast test DB via file-copy (12.5s→87ms)

### Web (`web/`)
- **Framework:** React 18, Vite, Tailwind 3.4 (Crimson After Dark tokens), React Router v6
- **Libraries:** Recharts (charts), Framer Motion, @dnd-kit (Kanban drag-and-drop),
  Lucide React (icons)
- **Auth:** AuthContext with localStorage token persistence, 401 auto-redirect
- **UI kit:** Button, Card, Badge, Input/Select/Textarea, Avatar, Modal, Spinner,
  EmptyState, ProgressBar, Field — all themed
- **Layout:** AppShell with collapsible sidebar, workspace switcher, TopNav with
  notifications, global command palette (⌘K / Ctrl+K) with fuzzy search
- **Pages:** Login, Register, Dashboard, Issues (filterable + paginated table),
  IssueDetail (relations + comments + AI summary), NewIssue (with AI severity suggest),
  Board (draggable Kanban), Projects, ProjectDetail, Sprints, Developers,
  Analytics, Activity, Settings
- **Build:** `vite build` produces 6 optimized chunks (largest 384KB chart bundle),
  `tsc` clean, no warnings

## Verification
- `npm run build` — both workspaces build (server `tsc`, web `tsc -b && vite build`)
- `npm test` — 37/37 tests pass (3.96s)
- End-to-end: frontend proxy → backend login → issues → analytics (all 200 OK)

## How to Run (Dev)
```
npm run dev             # both server + web concurrently
# or separately:
npm run dev:server      # API on :4000
npm run dev:web         # Frontend on :5173
```

Database is already seeded. Login with any seeded user (password: `devpassword123`)
or register a new account at `/register`.

## Environment
- Node v22.23.2, npm 10.9.8, Windows
- Server DB: `server/prisma/dev.db` (SQLite)
- Test DB: `server/prisma/test.db` (cloned from dev.db per test run)
