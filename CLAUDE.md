# Project 803 - AI-Moderated Debate Platform

## Deployment (EC2)

**Server:** `http://63.179.116.133:3000/`
**SSH:** `ssh -i project803.pem ubuntu@63.179.116.133`
**PEM file:** `project803.pem` (in project root, gitignored)

### Deploy steps

```bash
# 1. Sync files to server (excludes node_modules, .next, .env, .pem, venv, .git)
rsync -avz --exclude='node_modules' --exclude='.next' --exclude='.env' --exclude='.env.local' --exclude='project803.pem' --exclude='services/venv' --exclude='.git' -e "ssh -i project803.pem" ./ ubuntu@63.179.116.133:~/debates/

# 2. Build on server
ssh -i project803.pem ubuntu@63.179.116.133 "cd ~/debates/app && pnpm install --frozen-lockfile && pnpm build"

# 3. Restart Next.js
ssh -i project803.pem ubuntu@63.179.116.133 "pm2 restart nextjs"
```

### Server structure

- **Project path:** `/home/ubuntu/debates/`
- **Process manager:** PM2 (`ecosystem.config.cjs`)
- **Services:**
  - `nextjs` — Next.js on port 3000
  - `memo_processor` — Python on port 8001
  - `pairing_engine` — Python on port 8003
  - `debate_moderator` — Python on port 8004
  - `evaluator` — Python on port 8005
- **Python venv:** `/home/ubuntu/debates/services/venv/`
- **Runtime:** Node 20, pnpm, Ubuntu 24.04

### Useful commands

```bash
# View logs
ssh -i project803.pem ubuntu@63.179.116.133 "pm2 logs nextjs --lines 50"

# Restart all services
ssh -i project803.pem ubuntu@63.179.116.133 "pm2 restart all"

# Check status
ssh -i project803.pem ubuntu@63.179.116.133 "pm2 list"

# DB push (schema changes)
ssh -i project803.pem ubuntu@63.179.116.133 "cd ~/debates/app && pnpm db:push"
```

## Local Development

- `cd app && pnpm dev` — Next.js dev server on port 3000
- `docker compose up -d` — Postgres (5433), Redis (6379), MinIO (9000/9001)
- DB: `postgresql://debates:debates@localhost:5433/debates`
- Seed: `cd scripts && npm run seed`
- Login: instructor `smith@columbia.edu` / `instructor123`, students use name + course code `ECON803`
