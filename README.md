# NEXUS — AI Learning OS (React + Node + SQLite)

Offline-first learning OS: import HTML lessons, track progress, and use every
sidebar module against a **real local SQLite database** served by a **Node.js**
backend. No cloud required.

## Architecture

| Layer | Tech |
|-------|------|
| UI | React + Vite + React Router |
| API | Express on `http://127.0.0.1:8787` |
| Database | SQLite file at `data/nexus.db` (Node built-in `node:sqlite`) |

The frontend talks only to `/api/*`. In development Vite proxies that to the
Node server. In production, `npm run build` then `npm start` serves the UI and
API from one process.

## Run (offline)

```bash
npm install
npm run dev
```

- Web UI: http://127.0.0.1:4173  
- API health: http://127.0.0.1:8787/api/health  
- Next Door standalone site: http://127.0.0.1:4174  
- DB file created automatically: `data/nexus.db`

Production-style:

```bash
npm run build
npm start
```

Then open http://127.0.0.1:8787. The standalone Next Door site is available at
http://127.0.0.1:4174.

## What actually works

**Lessons (core)**  
Import HTML → sanitize → save to SQLite → sandboxed viewer → scroll progress,
notes, complete/bookmark, search/filter, journey, today's mission, delete.

**Every sidebar destination** is implemented against the local DB:

- Knowledge Concepts / Graph / Mastery Matrix  
- Projects, Architecture notes, Capstones, Portfolio  
- Code Lab (local JS runner), Snippets, Debug Center  
- Offline AI Tutor (retrieves from your lesson library — no cloud LLM)  
- Today's Review, Flashcards (spaced), Weak Areas, Arena Challenges, Exam Mode  
- Resources, Datasets registry, Research Notes  
- Engineer Profile, Job Readiness checklist, Interview Prep bank  
- Telemetry & Analytics (real counts + activity streak)  
- Settings (display name, DB path/size)

Streak in the header is computed from real `activity_log` days in SQLite.

## API sketch

- `GET/POST /api/lessons` … open, scroll, toggle, delete  
- `GET/PUT /api/settings`, `GET /api/storage`, `GET /api/analytics`  
- CRUD for notes, snippets, projects, flashcards, resources, datasets,
  interview questions, debug issues, concepts  
- `POST /api/tutor/ask`, `POST /api/code-lab/run`

## Tests

```bash
npm test
```

Pure lesson-logic unit tests (unchanged).

## Requirements

- Node.js **22.5+** (this project was verified on Node 24 — uses `node:sqlite`)
