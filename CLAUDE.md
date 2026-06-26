# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development

```bash
# Backend (runs on port 8000)
make backend

# Frontend (runs on port 3000, proxies /api to localhost:8000)
make frontend

# Run all tests
make test

# Backend tests only (uses applyquest_test DB)
make test-backend

# Run a single backend test file
cd backend && .venv/bin/pytest tests/test_gamification.py -v

# Frontend tests
make test-frontend

# Install the pre-commit hook (runs the full `make test` suite before every commit)
make install-hooks
```

Backend tests use the `applyquest_test` Postgres DB (set via `POSTGRES_DB=applyquest_test`); `tests/conftest.py` handles fixtures. `make setup` bootstraps `backend/.venv` and is a prerequisite of the backend/test targets. A `shell.nix` is provided for a reproducible Nix dev environment.

### Database migrations

```bash
cd backend && .venv/bin/alembic upgrade head
cd backend && .venv/bin/alembic revision --autogenerate -m "description"
```

### Backend environment

Settings are defined in `core/config.py` (pydantic `BaseSettings`, loaded from `backend/.env`). Required (no default): `POSTGRES_SERVER`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`. Others have defaults but should be overridden: `SECRET_KEY`, `RESEND_API_KEY`, `SHARE_PASSWORD` (mentor view), `USER_EMAIL` (the single target user), `MENTOR_EMAILS` (comma-separated), `EMAIL_FROM`. `SQLALCHEMY_DATABASE_URI` is derived from the `POSTGRES_*` values if not set explicitly.

## Architecture

### Single-user design

This app is built for a single user (configured via `USER_EMAIL` in settings). The scheduler, streak tracking, and email notifications all target this one user. The `Share` endpoint provides a read-only mentor view authenticated by a simple shared password (`SHARE_PASSWORD`).

### Backend (`backend/app/`)

**FastAPI + SQLAlchemy + PostgreSQL.** All routes live under `/api/v1` (defined in `api/v1/api.py`). JWT-based auth with a 1-week token expiry (`core/security.py`).

Key data flows:
- Every mutating application action goes through `core/gamification.add_points()` which creates a `PointHistory` record and recalculates `user.level` and `user.current_streak` atomically before the caller commits.
- Streak logic uses Berlin timezone (`Europe/Berlin`) and skips weekends/holidays defined in `backend/data/` JSON files (`german_holidays.json`, `kerala_holidays.json`, `leaves.json`). The `core/working_days.py` module handles this.
- Scheduled jobs (APScheduler `BackgroundScheduler`) run in `core/scheduler.py`: daily reminder at 20:00, streak check at 00:05, weekly summary on Sunday 19:00, and a follow-up digest at 09:00 — all Berlin time.

Models: `User`, `Application` + `ApplicationHistory`, `NetworkContact`, `PointHistory` (in `app/models/`).

**Follow-up logic** (`core/followup.py`): applications are classified as `needs_followup` (≥7 days stale, no follow-up sent), `awaiting_response` (<3 days since follow-up), or `needs_decision` (≥3 days since follow-up).

### Frontend (`frontend/src/`)

**React + TypeScript + Tailwind CSS.** Uses `react-router-dom` v7 and `recharts` for analytics.

- All API calls go through `services/api.ts`, which manually maps snake_case backend fields to camelCase TypeScript types. There is no auto-transformation library.
- Global state (user, applications, contacts, auth status) lives in `context/AppContext.tsx`. All pages consume this context rather than fetching data independently.
- Two auth modes: regular user (JWT token in `localStorage`) and mentor view (password-based, read-only via the share endpoint).
- The dev server proxies `/api` to `http://localhost:8000` (set in `package.json`).

### MCP server (`backend/mcp_server.py`)

A stdio MCP server that lets an AI agent (e.g. Claude with the Gmail connector) reconcile the inbox with tracked applications — find a job, mark it Applied/Rejected, or create it from an email's job details. It is a **thin client over the REST API** (via `httpx`), so all status-transition rules, history, gamification, and notification emails run exactly as in the web UI. Tools: `list_applications`, `find_applications`, `get_application`, `mark_status`, `create_application`, `update_application`.

- **Auth:** the server sends `X-API-Key: $APPLYQUEST_API_KEY`. `api/deps.py:get_current_user` accepts this header as an alternative to JWT and resolves it to the single `USER_EMAIL` user (`reusable_oauth2` is `auto_error=False` so a missing token falls through to the key check). An empty `APPLYQUEST_API_KEY` disables key auth entirely.
- **Run:** `APPLYQUEST_API_KEY=… backend/.venv/bin/python backend/mcp_server.py` (reads `APPLYQUEST_API_BASE`, default `http://localhost:8000/api/v1`). Requires the backend to be running.
- **Wire into Claude:** project-scoped `.mcp.json` at the repo root launches it; set `APPLYQUEST_API_KEY` in the environment. Enable the Gmail connector alongside it, then ask Claude to reconcile applications against recent mail.

### Firefox Extension (`extension/`)

Plain HTML/CSS/JS, no build step. Manifest V3, Firefox-only (`browser.*` APIs).

**Three JS contexts:**
- `background.js` — service worker; the only code that calls the ApplyQuest API. Handles messages: `DO_LOGIN`, `SAVE_JOB`, `GET_SETTINGS`, `CLEAR_AUTH`. All `fetch()` calls go here to avoid page CSP issues.
- `content/` — injected into job pages on load. Six files loaded in order: five site extractors (`linkedin.js`, `indeed.js`, `glassdoor.js`, `xing.js`, `stepstone.js`) each defining a global `extractX()` function, plus `extractor.js` which is the message listener that routes `EXTRACT_JOB` to the right function and responds with `{ success, data }`.
- `popup.js` — toolbar popup UI. On open: queries active tab, sends `EXTRACT_JOB` to content script, populates the form. On submit: sends `SAVE_JOB` to background.

**Auth:** JWT token stored in `browser.storage.local`. Settings page (`settings.html`) handles first-run login. Token expires in 1 week (matching backend); on 401 the popup shows a reconnect prompt.

**To load in Firefox:** `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → select `extension/manifest.json`.

**CORS:** `backend/app/main.py` uses `allow_origin_regex=r"moz-extension://.*"` with `allow_credentials=False` (safe — the app uses Bearer tokens, not cookies).

### Deployment

The frontend deploys via GitHub Actions (nginx serves the static build). See `DEPLOYMENT.md` for server setup, required GitHub secrets, and the nginx config in `nginx/`. `scripts/start-tunnel.sh` exposes a local instance over a Cloudflare tunnel.

**Live production:** `https://applyquest.anishsheela.com` (frontend + the API under `/api/v1`). The older `applyquest.vps.anishsheela.com` host in `DEPLOYMENT.md` no longer resolves — use the bare domain. The access-token (login) endpoint is `POST /api/v1/access-token`.

### Reading production data

There is no committed DB dump and the local `applyquest` DB is usually empty, so inspecting real data means hitting prod read-only. Two ways:

- **API key (single-user):** `curl https://applyquest.anishsheela.com/api/v1/applications/ -H "X-API-Key: $APPLYQUEST_API_KEY"` — same key the MCP server uses (see [MCP server](#mcp-server-backendmcp_serverpy)). The key value must match prod's `APPLYQUEST_API_KEY` env (which can differ from any local value); a mismatch returns `403 Could not validate credentials`. Never commit the key.
- **Share password (read-only mentor view):** `curl -X POST https://applyquest.anishsheela.com/api/v1/share/data -H 'Content-Type: application/json' -d '{"password":"<SHARE_PASSWORD>"}'` — returns the full mentor dataset (applications + history, contacts, user) without needing the API key.
- **SSH (most reliable):** `ssh anish@vps.anishsheela.com`, then `cd ~/applyquest/backend` (its `.env` symlinks to `~/applyquest/.env.prod`). Source `.env` for `POSTGRES_*` and run read-only `psql` queries directly. Note the DB stores enum *names* (`REJECTED`, `PHONE_SCREEN`) while the API serializes the title-case *values* (`Rejected`, `Phone Screen`).

### Points system

- Create application: +2 pts
- Status change to interview stages: +5–15 pts depending on stage
- Milestones (10/25/50/100 applications) trigger email notifications via Resend API (`core/email.py`).
- Levels: 1 (0 pts) → 6 "Offer Magnet" (1500 pts), defined in `core/gamification.py`.
