# Project 803 — AI-Moderated Debate Platform

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![Anthropic](https://img.shields.io/badge/Claude-Haiku%20%2B%20Sonnet-D97706?logo=anthropic&logoColor=white)
![Deepgram](https://img.shields.io/badge/Deepgram-Nova--3-13EF93)
![Daily.co](https://img.shields.io/badge/Daily.co-WebRTC-1F2937)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)
![Drizzle](https://img.shields.io/badge/Drizzle-ORM-C5F74F)
![PM2](https://img.shields.io/badge/PM2-Process%20Manager-2B037A)
![License](https://img.shields.io/badge/License-Private-red)

A live oral debate platform where university students defend their written memos in structured, AI-moderated video debates. Built for ECON 803 at Columbia University.

Students upload position memos on assigned readings, get paired with an opponent who argued the opposite side, and debate live on video. An AI moderator listens in real time — fact-checking claims against the readings, suggesting follow-up questions, and providing personalized feedback after the debate.

## How It Works

```
Professor creates assignment (prompt, rubric, readings, deadlines)
        ↓
Students sign up → verify email → set availability → upload PDF memo
        ↓
AI analyzes memo (Claude Haiku) → extracts position, thesis, key claims
        ↓
Student confirms detected position
        ↓
Professor generates AI pairings (Claude Sonnet) → sends debate invitations
        ↓
Students debate (~13 min, 4 phases, real-time AI moderation)
        ↓
AI auto-evaluates (Claude Sonnet) → scores + narrative summary
        ↓
Professor reviews results → exports CSV
```

## Debate Structure

| Phase | Duration | Description |
|-------|----------|-------------|
| Opening Statements | 2 min each | Present thesis and key arguments |
| Cross-Examination | 3 min each | Question the opponent on their claims |
| Rebuttals | 1 min each | Address the opponent's strongest points |
| Closing Statements | 30 sec each | Summarize why your position holds |

During the debate:
- **Real-time transcription** via Deepgram streams through a WebSocket
- **AI moderator** listens with phase-specific behavior (flags factual errors, suggests follow-ups, nudges silence)
- **Fact-checking** against indexed reading passages using RAG
- **Phase summaries** — AI-generated recap shown between phases so students can review key arguments
- Students can **pause**, **+1 min** to extend, or **skip** to the next phase

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js App (3000)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ Student  │  │Professor │  │  Admin   │  │  API Routes│  │
│  │  Pages   │  │  Pages   │  │  Pages   │  │            │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────────┐
        ▼              ▼                  ▼
┌──────────────┐ ┌───────────┐  ┌──────────────┐
│memo_processor│ │  debate   │  │  evaluator   │
│  (8001)      │ │ moderator │  │   (8005)     │
│ PDF + Claude │ │  (8004)   │  │Claude Sonnet │
│    Haiku     │ │ WS+Haiku  │  │  scoring     │
└──────────────┘ └─────┬─────┘  └──────────────┘
                       │
              ┌────────┼────────┐
              ▼        ▼        ▼
          Daily.co  Deepgram  PostgreSQL
          (WebRTC)  (Nova-3)
```

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

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS, Zustand, shadcn/ui |
| Auth | NextAuth v5 (JWT, email-code + password providers) |
| Database | PostgreSQL 17 with pgvector, Drizzle ORM |
| Video | Daily.co (WebRTC) |
| Speech-to-Text | Deepgram Nova-3 (streaming WebSocket) |
| AI | Claude Haiku (real-time), Claude Sonnet (evaluation + pairing) |
| RAG | sentence-transformers (MiniLM) embeddings + pgvector |
| PDF Processing | pymupdf4llm |
| Email | Resend |
| Storage | Local filesystem (S3-compatible fallback) |
| Process Manager | PM2 |

## Roles

| Role | Capabilities |
|------|-------------|
| **Student** | Sign up, upload memo, debate, receive scores, upload profile photo |
| **Professor** | Create assignments, review memos, generate pairings, review evaluations, export CSV |
| **Super Admin** | Manage classes, professor accounts, system-wide monitoring + all professor features |

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
cd app && pnpm install

# Push database schema
pnpm db:push

# Seed test data
cd ../scripts && npm run seed

# Start Next.js
cd ../app && pnpm dev
```

### Environment Variables

Create `app/.env.local`:

```env
DATABASE_URL=postgresql://debates:debates@localhost:5433/debates
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000
DAILY_API_KEY=your-daily-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
DEEPGRAM_API_KEY=your-deepgram-api-key
NEXT_PUBLIC_DEBATE_MODERATOR_URL=ws://localhost:8004
MEMO_PROCESSOR_URL=http://localhost:8001
READING_INDEXER_URL=http://localhost:8002
PAIRING_ENGINE_URL=http://localhost:8003
DEBATE_MODERATOR_URL=http://localhost:8004
EVALUATOR_URL=http://localhost:8005
```

### Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Professor | smith@columbia.edu | instructor123 |
| Admin | admin@columbia.edu | admin123 |

## Testing

```bash
cd services/debate_moderator
python -m pytest test_phase_summary.py test_integration.py -v -s
```

- **Unit tests** (`test_phase_summary.py`) — Mocked Claude API, tests phase summary generation logic
- **Integration tests** (`test_integration.py`) — Real Claude API calls over the full WebSocket pipeline
- Requires `ANTHROPIC_API_KEY` in root `.env`; auto-skips if not set

## Project Structure

```
debates/
├── app/                          # Next.js application
│   └── src/
│       ├── app/                  # App Router pages & API routes
│       │   ├── (student)/        # Student pages (dashboard, debate, assignment)
│       │   ├── professor/        # Professor pages
│       │   ├── admin/            # Super admin pages
│       │   ├── signup/           # Student signup flow
│       │   └── api/              # API routes
│       ├── components/           # React components
│       │   ├── debate/           # Debate session, video, phases, debrief
│       │   ├── student/          # Memo upload, photo upload, position confirmation
│       │   ├── instructor/       # Rubric builder, evaluation display
│       │   └── ui/               # shadcn/ui primitives
│       └── lib/                  # Auth, DB, hooks, storage, email
├── services/                     # Python microservices
│   ├── memo_processor/           # PDF extraction + Claude analysis (8001)
│   ├── reading_indexer/          # Embedding + vector search (8002)
│   ├── pairing_engine/           # Student matching algorithm (8003)
│   ├── debate_moderator/         # Real-time AI moderation + STT (8004)
│   ├── evaluator/                # Post-debate scoring (8005)
│   └── shared/                   # Shared utilities
├── scripts/                      # Seed data
├── docker-compose.yml            # Local Postgres, Redis, MinIO
└── ecosystem.config.cjs          # PM2 process config (production)
```
