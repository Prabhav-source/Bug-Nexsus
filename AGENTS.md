# AGENTS.md

## Project: BUGNEXUS 2.0

Full-stack bug tracking & developer-intelligence platform (Express + Prisma + React + Vite).

## Commands

| Task              | Command                          | Workspace |
|-------------------|----------------------------------|-----------|
| Lint / type-check | `npx tsc --noEmit`               | root, or `server`/`web` |
| Build (prod)      | `npm run build`                  | root      |
| Test              | `npm test`                       | root (`server` workspace) |
| Dev (full stack)  | `npm run dev`                    | root      |
| Dev (server only) | `npm run dev:server`             | root      |
| Dev (web only)    | `npm run dev:web`                | root      |
| DB push           | `npm run db:push`                | root      |
| DB seed           | `npm run db:seed`                | root      |
| DB Studio         | `npm run db:studio`              | root      |

## Workspace layout

- `server/` — API (TypeScript, Prisma, SQLite, Express)
- `web/` — frontend (React, Vite, Tailwind)

## Notes for agents

- SQLite does **not** support Prisma enums or `mode: 'insensitive'` — use
  plain `String` fields with Zod validation.
- SQLite does **not** support `createMany({ skipDuplicates })` — use a loop of
  `create` instead.
- Tests use `server/prisma/test.db`, cloned from `dev.db` for speed (setup <100 ms).
- The Vite dev server proxies `/api` to `http://localhost:4000`.
