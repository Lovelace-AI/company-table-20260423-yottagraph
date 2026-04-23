# Aether

**Read first:** [`.cursor/skills/aether/SKILL.md`](.cursor/skills/aether/SKILL.md) — the Aether skill indexes every topic below and is the canonical entry point for any work in this repo.

**Stack:** Nuxt 3 (SPA), Vue 3 Composition API (`<script setup>`), Vuetify 3, TypeScript (required), Auth0.

**Structure:** `pages/` (file-based routing), `components/`, `composables/`, `server/api/`, `agents/` (Python ADK), `mcp-servers/` (Python FastMCP).

**Data:** This app runs on the Lovelace platform -- entities, news, filings, sentiment, relationships, events. See [`data.md`](.cursor/skills/aether/data.md) in the `aether` skill for access patterns and gotchas. Additional skill docs: `skills/data-model/` (entity types, properties, relationships; `SKILL.md` first), `skills/elemental-mcp-patterns/` (MCP response shapes, property type handling, Python patterns for agent tools). Do NOT call external APIs for data the platform provides.

**Storage:** KV (Upstash Redis) for preferences and lightweight state via `Pref<T>` from `usePrefsStore()`. Neon Postgres for relational data if connected (see [`storage.md`](.cursor/skills/aether/storage.md) in the `aether` skill).

**Source of truth:** `DESIGN.md` -- read before starting work, update when changing features. The starter UI is placeholder -- replace freely. Feature docs in `design/` for implementation planning.

**Git:** Commit meaningful units of work. Run `npm run format` before commit. Message format: `[Agent commit] {summary}`. Push directly to main — do NOT create PRs or feature branches.

**First action for a new project:** Run `/build_my_app`.

## Task-specific topics

The `aether` skill (`.cursor/skills/aether/SKILL.md`) covers architecture, data, UI cookbook, agents, MCP servers, deployment, env, storage, troubleshooting, and more. Read `SKILL.md` first; it's a short index that points you to the specific topic file you need.

## Environment

Detect your runtime once at startup, then read the matching topic in the `aether` skill:

- **Cursor Cloud** if `$HOME` starts with `/root` or `/home/ubuntu`, OR `uname -s` reports `Linux` in a container-shaped path, OR a "Dev Server" terminal was auto-started from `.cursor/environment.json`. → Read [`cursor-cloud.md`](.cursor/skills/aether/cursor-cloud.md).
- **Local dev** if `$HOME` is under `/Users/…` (macOS) or a normal Linux/Windows user home, and no "Dev Server" terminal is auto-running. → If `.env` and `node_modules/` are present, you're set up; otherwise read [`local-setup.md`](.cursor/skills/aether/local-setup.md).

This check is cheap and only needs to run once per session.

### Cursor instructions (`.cursor/`)

Cursor commands and skills are installed from the
`@yottagraph-app/aether-instructions` npm package during project init.
`.cursor/skills/aether/` is the main Aether skill.
`.cursor/skills/elemental-api/` contains API skill documentation (endpoint
reference, types, usage patterns). `.cursor/skills/data-model/` contains
Lovelace data model documentation (entity types, schemas per fetch source).
If these directories are missing, run `/update_instructions` to reinstall.

## Configuration

`broadchurch.yaml` contains tenant-specific settings (GCP project, org ID,
service account, gateway URL, query server URL). It's generated during
provisioning and committed by the `tenant-init` workflow. Don't edit manually
unless you know what you're doing.

## Verification Commands

```bash
npm run dev          # dev server -- check browser at localhost:3000
npm run build        # production build -- catches compile errors
npm run format       # Prettier formatting (run before committing)
```

## Known Issues

### Port 3000 conflict

The dev server binds to port 3000 by default. If another service is already
using that port, start with `PORT=3001 npm run dev`.

### Formatting

Pre-commit hook runs `lint-staged` with Prettier. Run `npm run format` before
committing to avoid failures.
