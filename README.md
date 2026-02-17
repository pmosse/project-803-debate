# Project 803 — AI-Moderated Debate Platform

A live oral debate platform where university students defend their written memos in structured, AI-moderated video debates. Built for ECON 803 at Columbia University.

Students upload position memos on assigned readings, get paired with an opponent who argued the opposite side, and debate live on video. An AI moderator listens in real time — fact-checking claims against the readings, suggesting follow-up questions, and providing personalized feedback after the debate.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js App (port 3000)               │
│  App Router · NextAuth · Drizzle ORM · Tailwind          │
├─────────────────────────────────────────────────────────┤
│                     Python Services                      │
│                                                          │
│  memo_processor (8001)    reading_indexer (8002)          │
│  pymupdf4llm + Claude     sentence-transformers + pgvector│
│                                                          │
│  pairing_engine (8003)    debate_moderator (8004)         │
│  greedy matching           WebSocket + Deepgram + Claude  │
│                                                          │
│  evaluator (8005)                                        │
│  Claude Sonnet scoring                                   │
├─────────────────────────────────────────────────────────┤
│  PostgreSQL (pgvector) · Redis · MinIO                   │
└─────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), React, Tailwind CSS, shadcn/ui |
| Auth | NextAuth v5 (credentials provider) |
| Database | PostgreSQL 17 with pgvector, Drizzle ORM |
| Video | Daily.co (WebRTC) |
| Speech-to-Text | Deepgram Nova-3 (streaming WebSocket) |
| AI Moderation | Claude Haiku 4.5 (real-time), Claude Sonnet 4.5 (evaluation) |
| RAG | sentence-transformers (MiniLM) embeddings + pgvector similarity search |
| PDF Processing | pymupdf4llm |
| File Storage | MinIO (S3-compatible) |
| Process Manager | PM2 |
| Tunneling | Cloudflare Quick Tunnels (WebSocket proxy for moderator) |

## How It Works

### 1. Memo Upload & Analysis
Students upload a position memo (PDF). The memo processor extracts text, then Claude analyzes it to identify the thesis, key claims, citations, and stance (net positive/negative).

### 2. Pairing
The pairing engine matches students with opposing positions, maximizing argument diversity. Each pair gets a Daily.co video room.

### 3. Live Debate (~13 min)
Four phases, each timed:

| Phase | Duration | Description |
|-------|----------|-------------|
| Opening Statements | 2 min each | Present thesis and key arguments |
| Cross-Examination | 3 min each | Question the opponent on their claims |
| Rebuttals | 1 min each | Address the opponent's strongest points |
| Closing Statements | 30 sec each | Summarize why your position holds |

During the debate:
- **Real-time transcription** via Deepgram streams through a WebSocket
- **AI moderator** listens in all phases with phase-specific behavior (e.g., only flags factual errors during openings, actively suggests follow-ups during cross-exam)
- **Fact-checking** against indexed reading passages using RAG
- **Silence detection** nudges speakers after 15s of inactivity
- **Phase prompts** provide contextual guidance at each transition

### 4. Post-Debate
- Personalized AI debrief (what went well, what to improve)
- Claude Sonnet evaluates each student on reading accuracy, evidence use, rebuttal quality
- Instructor reviews transcripts, scores, and AI summaries

## Local Development

### Prerequisites
- Node.js 20+, pnpm
- Docker (for Postgres, Redis, MinIO)
- Python 3.12+ with venv

### Setup

```bash
# Start infrastructure
docker compose up -d

# Install dependencies
pnpm install

# Push database schema
cd app && pnpm db:push

# Seed test data
cd ../scripts && npm run seed

# Start Next.js
cd ../app && pnpm dev
```

### Environment Variables

Create `app/.env.local`:

```env
# Database
DATABASE_URL=postgresql://debates:debates@localhost:5433/debates

# Auth
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000

# Daily.co
DAILY_API_KEY=your-daily-api-key

# AI
ANTHROPIC_API_KEY=your-anthropic-api-key

# Speech-to-text
DEEPGRAM_API_KEY=your-deepgram-api-key

# Moderator WebSocket (use ws:// for local, wss:// for tunneled)
NEXT_PUBLIC_DEBATE_MODERATOR_URL=ws://localhost:8004

# Services
MEMO_PROCESSOR_URL=http://localhost:8001
READING_INDEXER_URL=http://localhost:8002
PAIRING_ENGINE_URL=http://localhost:8003
DEBATE_MODERATOR_URL=http://localhost:8004
EVALUATOR_URL=http://localhost:8005
```

### Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Instructor | smith@columbia.edu | instructor123 |
| Students | (use name + course code) | ECON803 |

## Project Structure

```
debates/
├── app/                          # Next.js application
│   └── src/
│       ├── app/                  # App Router pages & API routes
│       │   ├── (auth)/           # Login
│       │   ├── (student)/        # Student pages (dashboard, debate, assignment)
│       │   ├── instructor/       # Instructor pages
│       │   └── api/              # API routes
│       ├── components/           # React components
│       │   ├── debate/           # Debate session, AI bar, timer, debrief
│       │   ├── instructor/       # Instructor tools
│       │   └── ui/               # shadcn/ui primitives
│       └── lib/                  # Auth, DB, hooks, utilities
├── services/                     # Python microservices
│   ├── memo_processor/           # PDF extraction + Claude analysis
│   ├── reading_indexer/          # Embedding + vector search
│   ├── pairing_engine/           # Student matching algorithm
│   ├── debate_moderator/         # Real-time AI moderation + STT
│   └── evaluator/                # Post-debate scoring
├── scripts/                      # Seed data
├── docker-compose.yml            # Local Postgres, Redis, MinIO
└── ecosystem.config.cjs          # PM2 process config (production)
```
