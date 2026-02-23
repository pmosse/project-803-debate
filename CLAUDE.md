# Project 803 - AI-Moderated Debate Platform

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

## Local Development

- `cd app && pnpm dev` — Next.js dev server on port 3000
- `docker compose up -d` — Postgres (5433), Redis (6379), MinIO (9000/9001)
- DB: `postgresql://debates:debates@localhost:5433/debates`
- Seed: `cd scripts && npm run seed`
- Login: instructor `smith@columbia.edu` / `instructor123`, students use name + course code `ECON803`

## Architecture Notes

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

### Assignments
- Course code is auto-filled from instructor session (not user-editable)
- All students see all assignments (no course code filtering)
- Readings are optional
