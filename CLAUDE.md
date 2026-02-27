# Project 803 - AI-Moderated Debate Platform

## What This Is

An AI-moderated oral debate platform for university courses. Professors create debate assignments, students upload memos, get paired by AI, and participate in structured ~13-minute real-time video debates with an AI moderator. The system automatically scores and generates narrative summaries.

## Roles

- **Student** — Signs up, uploads memo, debates, receives scores
- **Professor** — Creates assignments, reviews memos, generates pairings, reviews evaluations
- **Super Admin** — Manages classes, professor accounts, system-wide monitoring + all professor features

## End-to-End Flow

1. Professor creates assignment (prompt, rubric, readings, deadlines, access controls)
2. Students sign up via unique link, verify email, set availability, upload PDF memo
3. System analyzes memo (extract text → Claude identifies position/thesis/claims)
4. Student confirms detected position
5. Professor generates AI pairings (Claude Sonnet matches by argument divergence + availability)
6. Professor sends debate invitations (email with link, deadline, suggested times)
7. Students debate (~13 min structured phases with AI moderator)
8. System auto-evaluates (Claude Sonnet scores against rubric using transcript + memo)
9. Professor reviews results, exports CSV

## Debate Structure

| Phase | Duration | Description |
|-------|----------|-------------|
| Opening | 2 min each | Present thesis and key arguments |
| Cross-Exam | 3 min each | Question opponent on evidence gaps |
| Rebuttal | 1 min each | Address opponent's strongest points |
| Closing | 30 sec each | Final summary |

- 10-second grace period after each timer expires
- Ready check between phases: AI summary of the completed phase + transition message, both students confirm before advancing
- Students can click **+1 min** to extend any phase or **Skip** to move ahead
- AI moderator intervenes in real-time: prompts for citations, fact-checks, nudges silence

## AI Models

| Task | Model | Service |
|------|-------|---------|
| Memo analysis | Claude Haiku | memo_processor (8001) |
| Pairing | Claude Sonnet | Next.js API |
| Live moderation | Claude Haiku | debate_moderator (8004) |
| Phase summaries | Claude Haiku | debate_moderator (8004) |
| Evaluation & scoring | Claude Sonnet | evaluator (8005) |
| Student debrief | Claude Haiku | Next.js API |
| Speech-to-text | Deepgram Nova-3 | Daily.co integration |

## Deployment (EC2)

**Server:** `http://63.179.116.133:3000/`
**Cloudflare tunnel:** `https://ipaq-posts-electro-raymond.trycloudflare.com/`
**SSH:** `ssh -i project803.pem ubuntu@63.179.116.133`
**PEM file:** `project803.pem` (in project root, gitignored)

### Deploy steps

```bash
# 1. Sync files to server (run from project root, not app/)
rsync -avz --exclude='node_modules' --exclude='.next' --exclude='.env' --exclude='.env.local' --exclude='project803.pem' --exclude='services/venv' --exclude='.git' -e "ssh -i project803.pem" ./ ubuntu@63.179.116.133:~/debates/

# 2. Build on server (must clear .next/cache first — disk is tight)
ssh -i project803.pem ubuntu@63.179.116.133 "cd ~/debates/app && rm -rf .next/cache && pnpm install --frozen-lockfile && pnpm build"

# 3. Restart Next.js
ssh -i project803.pem ubuntu@63.179.116.133 "pm2 restart nextjs"

# 4. If Python services changed, restart them too
ssh -i project803.pem ubuntu@63.179.116.133 "pm2 restart memo_processor"
```

### Server structure

- **Project path:** `/home/ubuntu/debates/`
- **Process manager:** PM2 (`ecosystem.config.cjs`)
- **Services:**
  - `nextjs` — Next.js on port 3000
  - `memo_processor` — Python on port 8001 (PDF extraction + Claude analysis)
  - `pairing_engine` — Python on port 8003 (greedy matching with argument diversity)
  - `debate_moderator` — Python on port 8004 (WebSocket + Deepgram STT + Claude moderation)
  - `evaluator` — Python on port 8005 (Claude scoring + summary generation)
- **Python venv:** `/home/ubuntu/debates/services/venv/`
- **Env files:** `/home/ubuntu/debates/.env` (shared), `/home/ubuntu/debates/app/.env.local` (Next.js)
  - Python services load env via symlinks to root `.env` (e.g. `services/memo_processor/.env -> ../../.env`)
- **Storage:** Local filesystem at `app/uploads/` (MinIO/S3 is NOT running on EC2)
- **Runtime:** Node 20, pnpm, Ubuntu 24.04
- **Disk:** Limited space (~7GB free) — always `rm -rf .next/cache` before building

### Useful commands

```bash
# View logs
ssh -i project803.pem ubuntu@63.179.116.133 "pm2 logs nextjs --lines 50"

# Restart all services
ssh -i project803.pem ubuntu@63.179.116.133 "pm2 restart all"

# Check status
ssh -i project803.pem ubuntu@63.179.116.133 "pm2 list"

# DB access
ssh -i project803.pem ubuntu@63.179.116.133 "PGPASSWORD=debates psql -h localhost -U debates -d debates"

# DB push (schema changes)
ssh -i project803.pem ubuntu@63.179.116.133 "cd ~/debates/app && pnpm db:push"
```

## Testing

```bash
cd services/debate_moderator
python -m pytest test_phase_summary.py test_integration.py -v -s
```

- `test_phase_summary.py` — Unit tests (mocked Claude) for `generate_phase_summary()`
- `test_integration.py` — Integration tests using **real Claude API** over the full WebSocket pipeline (DB/usage logging mocked)
- Requires `ANTHROPIC_API_KEY` in `.env`; tests auto-skip if not set

## Local Development

- `cd app && pnpm dev` — Next.js dev server on port 3000
- `docker compose up -d` — Postgres (5433), Redis (6379), MinIO (9000/9001)
- DB: `postgresql://debates:debates@localhost:5433/debates`
- Seed: `cd scripts && npm run seed`
- Login: professor `smith@columbia.edu` / `instructor123`, admin `admin@columbia.edu` / `admin123`
- Students use passwordless email-code login or name + course code `ECON803`

## Key File Paths

### Next.js App (`app/src/`)
- `app/(student)/` — Student pages (dashboard, assignment detail, debate)
- `app/(auth)/login/` — Login page (passwordless email code + password fallback)
- `app/professor/` — Professor pages (dashboard, assignment detail, student profile, debate view, costs, A/V test, how-it-works)
- `app/admin/` — Admin pages (dashboard, classes, professors, costs, how-it-works)
- `app/signup/[assignmentId]/` — Student signup flow (form → verify → availability → success)
- `app/api/` — All API routes
- `components/debate/` — Debate UI (session, daily-call, phase-timer, consent-modal, debrief, transcript-panel, ai-coach-panel)
- `components/student/` — Memo upload, processing status, position confirmation, delete button
- `components/instructor/` — Rubric builder, evaluation radar, criteria scores, signup link card
- `lib/auth/` — NextAuth config (JWT, 30-day sessions, email-code + password + impersonate providers)
- `lib/db/schema.ts` — Drizzle ORM schema (all tables)
- `lib/hooks/use-debate-store.ts` — Zustand store for debate state (phases, timers, ready checks)
- `lib/email/client.ts` — Resend email functions (invitations, verification, login codes, reminders)

### Python Services (`services/`)
- `memo_processor/` — PDF extraction (pymupdf4llm) + Claude analysis
- `debate_moderator/` — WebSocket server, Deepgram STT, Claude real-time moderation
- `evaluator/` — Claude Sonnet scoring (scorer.py) + narrative summary (summarizer.py)
- `shared/` — Shared utilities (usage logger)

## Architecture Notes

### Authentication
- NextAuth v5 with JWT strategy, 30-day session persistence
- Three providers: `unified-login` (email+password), `email-code` (passwordless), `impersonate`
- Login page defaults to email-code flow; password as fallback
- Roles checked via `isPrivilegedRole()` (professor or super_admin) in API routes
- Middleware protects `/professor/*` (requires professor/super_admin) and `/admin/*` (requires super_admin)

### Storage
- Both Node.js (`lib/storage/client.ts`) and Python (`memo_processor/main.py`) use a `USE_FS` flag
- Falls back to local filesystem when S3_ENDPOINT contains "localhost" or `STORAGE_MODE=fs`
- Files stored under `app/uploads/` (memos at `app/uploads/memos/{assignmentId}/{studentId}/{timestamp}.pdf`)

### Daily.co Transcription
- `rawResponse` property is missing from Daily.co transcription events in some contexts
- Both `av-test-client.tsx` and `daily-call.tsx` use a 1.5s silence timeout to promote interim text to final
- Transcription takes ~15 seconds to initialize after `startTranscription()` — the A/V test page shows a loading overlay during this

### Debate Session
- Phase changes: only the initiating client sends `phase_command` to backend; receiving client skips via `phaseFromRemoteRef` to prevent duplicate AI messages
- `add_time` WebSocket message broadcasts to both clients to keep timers in sync
- Ready check between phases: server generates AI phase summary + transition message (in parallel), overlay shows loading state → summary in blue box → "I'm Ready" button (disabled until loaded)
- Phase summary uses `generate_phase_summary()` — filters transcript by completed phase, sends to Claude Haiku (~50 words)

### Pairing
- Claude Sonnet matches by argument divergence, reading overlap, and availability
- Suggested meeting times extracted from `matchmakingReason` field via regex `[Suggested times: ...]`
- Fallback: simple opposing-position matching if Claude unavailable

### Evaluation
- Scores primarily from debate transcript, memo used as reference for authenticity checks
- Custom rubric criteria → per-criterion scores with reasoning
- Legacy mode → Opening Clarity, Rebuttal Quality, Reading Accuracy, Evidence Use
- Integrity flags detect memo inconsistencies (e.g., can't explain cited mechanism)

### Assignments
- Course code is auto-filled from instructor session (not user-editable)
- All students see all assignments (no course code filtering)
- Readings are optional
- Student availability stored as JSONB on `assignmentEnrollments`
