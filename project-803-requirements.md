# Project 803 — Technical Requirements Document

**Version:** 1.0
**Date:** February 7, 2026
**Purpose:** Complete build specification for MVP. This document should provide everything needed to implement the application end-to-end.

---

## 1. Product Summary

Project 803 is a web application for Columbia University where students submit a written memo in response to an assigned case study, then get paired with a peer who took the opposing position for a live, AI-moderated debate. The AI moderates the debate, verifies that students' claims are grounded in the assigned readings, and produces an instructor-ready assessment.

### Core Insight

Written memos are easy to outsource to AI. An oral debate against a real peer who read the same papers and argues the opposite side is nearly impossible to fake — you need genuine understanding to respond to unexpected counterarguments in real time.

### First Assignment: The Walmart Case

The pilot assignment asks: *"Should Walmart get the Nobel in Economics, in Peace, both, or burn in hell?"* Students read 3 academic papers on Walmart's economic impact, then write a one-page memo arguing their position with evidence from the readings.

---

## 2. User Roles

| Role | Description |
|------|-------------|
| **Student** | Logs in, views assignments, uploads memo, joins debate, sees "Completed" status |
| **Instructor** | Creates assignments, views all student results, scores, transcripts, debate analysis |
| **System/AI** | Parses memos, pairs students, moderates debates, generates evaluations |

---

## 3. End-to-End User Flow

### Step 1 — Instructor creates assignment
The instructor sets up the assignment on the platform: prompt text, rubric, and reading links/files. For v1, this is the Walmart case (can be pre-seeded).

### Step 2 — Student logs in
Student authenticates via course code (for pilot) or Columbia SSO (TBD). Lands on dashboard.

### Step 3 — Student views assignment
Dashboard shows assignments with due dates. Student opens "Assignment #1: Walmart" and sees: the prompt, the rubric, and links to the 3 required readings.

### Step 4 — Student uploads memo
Student writes their memo offline and uploads it (PDF or Word, max ~5 pages). The UI shows upload confirmation and processing status.

### Step 5 — System parses the memo
Backend extracts text, then uses an LLM to identify:
- **Thesis/position**: Pro-Walmart ("Net Positive") or Anti-Walmart ("Net Negative")
- **Key claims**: The specific arguments the student makes
- **Citations**: Which readings they reference and how
- **Stance strength**: How strongly they argue their position

Reference data from the Walmart pilot (27 students):
- 7 students were classified as 🟢 Pro-Walmart
- 10 as 🔴 Anti-Walmart
- 9 as 🟡 Mixed/Nuanced (these get reclassified to Net Positive or Net Negative based on the lean of their argument)
- 1 ⚪ Unreadable (scanned image PDF — edge case)

### Step 6 — System pairs students
The system creates debate pairings by matching one "Net Positive" student with one "Net Negative" student. Pairing should also consider:
- Diversity of core arguments (pair students with different specific claims, not just different positions)
- If odd number, one student could debate the AI as a fallback (v2 consideration)

From the pilot data, 12 students were classified as Net Positive and 14 as Net Negative, producing 12 viable pairings with 2 Net Negative students remaining unpaired.

### Step 7 — Students receive debate invitation
Both students get an email with:
- A unique video call link (public URL or URL with access code — no SSO required for the call)
- The scheduled debate window / deadline
- Brief instructions on what to expect

The system sends follow-up reminder emails before the deadline if the call hasn't happened yet.

### Step 8 — Live debate session
Both students join the in-browser video call. The AI moderates a structured debate:

| Phase | Duration | Description |
|-------|----------|-------------|
| **Opening A** | 2:00 | Student A presents their position |
| **Opening B** | 2:00 | Student B presents their position |
| **Cross-examination** | ~N:00 each | AI suggests questions for each student to ask the other. AI intervenes with reading-anchored probes ("Which reading supports that?") |
| **Rebuttals** | 1:00 each | Each student responds to the other's arguments |
| **Closing** | 0:30 each | Final statements |
| **Total** | ~12-15 min | TBD based on pilot testing |

During the session, the AI:
- Keeps time and enforces turn structure (visual timer + audio/visual cues)
- Monitors claims against the reading index
- Flags vague assertions or misstated papers
- Suggests follow-up questions when claims aren't grounded in evidence
- Streams live transcription

### Step 9 — Student sees completion
After the debate, the student sees a simple "Completed ✓" status. No score, no detailed feedback (that's instructor-only).

### Step 10 — Instructor reviews results
The instructor dashboard shows per-student output:
- **Pass/Fail or rubric score** + confidence level
- **Evidence-of-reading score**: how well the student demonstrated genuine engagement with the readings
- **Debate performance breakdown**: opening clarity, rebuttal quality, reading accuracy, evidence use
- **Transcript** with highlights (key moments, flags)
- **Video recording** (with retention policy)
- **AI-generated summary**: short, actionable narrative

---

## 4. Pages & UI Specification

### 4.1 Login Page
- Simple, clean login
- Input: course code (pilot) or Columbia SSO button (if implemented)
- Redirect to dashboard on success
- Design: minimal, academic feel — Columbia blue (#B9D9EB) as accent, not overwhelming

### 4.2 Student Dashboard
- **Header**: App name/logo, student name, logout
- **Assignment cards**: Each shows assignment title, status badge, due date
- Status progression: `Not Started` → `Memo Uploaded` → `Processing` → `Paired` → `Debate Scheduled` → `Completed`
- Click card → opens assignment detail

### 4.3 Assignment Detail Page
- **Left column / main area**:
  - Assignment prompt (rendered markdown/rich text)
  - Due dates (memo deadline, debate deadline)
- **Right column / sidebar**:
  - Rubric (collapsible)
  - Required readings as clickable links (external URLs to JSTOR, etc.)
  - Optionally: in-app PDF viewer for readings hosted on platform
- **Upload section**:
  - Drag-and-drop or file picker for memo (PDF, .docx)
  - Max file size: 10MB
  - Shows: upload progress → "Processing your memo..." → "Memo received ✓"
  - After processing: shows extracted position as confirmation ("We identified your position as: **Net Positive on Walmart**. Is this correct?" with option to flag if wrong)

### 4.4 Pairing & Scheduling Status
After memo is processed and student is paired:
- Show: "You've been paired with a classmate for your debate"
- Show: unique debate link + any scheduling info
- Show: deadline for completing the debate
- Do NOT reveal the opponent's identity, position, or memo content before the debate

### 4.5 Debate Session Page (In-Browser Video)
This is the most complex UI. Layout:

```
┌─────────────────────────────────────────────────┐
│  DEBATE: Walmart Case          ⏱ Opening A 1:47 │
├───────────────────────┬─────────────────────────┤
│                       │                         │
│   Student A Video     │   Student B Video       │
│                       │                         │
├───────────────────────┴─────────────────────────┤
│                                                 │
│   AI MODERATOR BAR                              │
│   "Student A, which reading supports your       │
│    claim about job creation?"                   │
│                                                 │
├─────────────────────────────────────────────────┤
│   Live transcript (scrolling, attributed)       │
│   Student A: "Basker's 2005 study shows..."     │
│   Student B: "But Neumark found that..."        │
└─────────────────────────────────────────────────┘
```

Key UI elements:
- **Video feeds**: Two side-by-side webcam views (peer-to-peer, 2 participants only)
- **Phase indicator + timer**: Shows current debate phase and countdown. Visual urgency as time runs low (color change from green → yellow → red)
- **AI moderator panel**: Text-based interventions from the AI. Could also have a subtle avatar or just a styled text area. Appears when AI has a prompt/question/flag.
- **Live transcript**: Real-time captions at the bottom, attributed to each speaker. Helps accessibility and creates the record.
- **Controls**: Mute mic, toggle camera, end call/leave
- **Phase transitions**: Clear visual/audio cue when moving between phases (e.g., gentle chime + overlay "Cross-Examination begins")

Design principles:
- Feel like a **learning experience**, not surveillance
- Clean, focused, distraction-free
- Timer should be prominent but not anxiety-inducing
- AI interventions should feel like a helpful moderator, not an interrogator

### 4.6 Post-Debate (Student View)
- Simple confirmation: "Debate completed ✓"
- "Your instructor will review the results."
- Optional: brief reflection prompt (not graded)

### 4.7 Instructor Dashboard
- **Assignment overview**: List of all students, their status in the pipeline
- **Pairing view**: Shows all debate pairs, whether completed
- **Per-student detail page**:
  - Score / rubric assessment
  - Evidence-of-reading score (0-100 or categorical)
  - Performance breakdown chart/table
  - Full transcript (searchable, with timestamps)
  - AI-generated summary (2-3 paragraph narrative)
  - Video playback (with timeline markers for key moments)
  - Flags: any integrity concerns highlighted
- **Export**: CSV/Excel export of all scores for grade book integration

---

## 5. Technical Architecture

### 5.1 Recommended Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | Next.js (React) + TypeScript | SSR for SEO-irrelevant but good DX, App Router, strong ecosystem |
| **Styling** | Tailwind CSS | Rapid UI development, consistent design system |
| **Backend API** | Next.js API routes + Python microservices | Next.js for CRUD/auth; Python for NLP/LLM pipelines |
| **Database** | PostgreSQL | Relational data (users, assignments, pairings, scores) |
| **File Storage** | AWS S3 or GCS | Memo uploads, recordings, transcripts |
| **Auth** | NextAuth.js | Course code auth (pilot) + SSO-ready |
| **Email** | SendGrid or Resend | Pairing notifications, reminders |
| **Video** | See Section 5.2 |  |
| **STT** | Deepgram or Whisper | Real-time streaming transcription |
| **LLM** | Claude API or GPT-4 | Memo parsing, question generation, evaluation |
| **RAG** | Vector DB (Pinecone/pgvector) + embeddings | Index readings for grounded questioning |

### 5.2 Video Solution — Recommendation & Analysis

This is the critical infrastructure decision. The app needs:
- 2-person video call embedded in-browser
- Real-time audio stream accessible for transcription
- Recording capability
- Programmable room creation (unique links per pair)
- No downloads / no plugins
- Affordable at pilot scale (~30 sessions)

**Option A: Daily.co (Recommended for MVP)**
- Pre-built embeddable UI ("Daily Prebuilt") — ship in days, not weeks
- Custom UI also available via their JS SDK
- 10,000 free participant-minutes/month (a 15-min debate with 2 students = 30 participant-minutes, so ~333 free debates/month)
- Programmatic room creation via REST API
- Built-in recording
- React SDK available (`@daily-co/daily-react`)
- Pay-as-you-go: $0.004/participant-minute after free tier
- HIPAA-ready infrastructure
- Note: Google Meet cannot be embedded or customized — it's not viable

**Option B: LiveKit (Cloud or self-hosted)**
- Open-source WebRTC SFU with cloud option
- More control, steeper learning curve
- Built-in AI agent framework (could run the moderator as a LiveKit Agent)
- React SDK available
- Free tier: 5,000 connection minutes
- Better long-term if you want the AI moderator to have direct audio access
- More complex to set up initially

**Option C: Jitsi Meet (self-hosted, open-source)**
- Free, self-hosted
- Embeddable via iframe
- Requires server management
- Less programmatic control
- Good for budget, bad for timeline

**Recommendation**: Start with **Daily.co** for the MVP. Fastest path to a working product. The pre-built UI gets video working in a day. Migrate to LiveKit later if you need tighter AI-audio integration or cost optimization at scale.

### 5.3 Core Pipelines (Backend Services)

**Pipeline 1: Memo Ingestion**
```
Upload (PDF/Word) → Text extraction (pdf-parse / mammoth.js) → Clean text → Store in DB
```

**Pipeline 2: Memo Analysis (LLM)**
```
Clean text + Assignment prompt + Rubric →
LLM prompt: "Extract thesis, position (Net Positive/Net Negative), key claims, citations, stance strength" →
Structured JSON output → Store in DB
```

**Pipeline 3: Reading Index (RAG)**
```
Reading PDFs → Text extraction → Chunk into passages →
Generate embeddings → Store in vector DB (pgvector or Pinecone) →
At query time: retrieve relevant passages for grounding questions
```

**Pipeline 4: Student Pairing**
```
All analyzed memos for assignment →
Binary classification: Net Positive vs Net Negative →
Match pairs (opposing positions, diverse arguments) →
Create debate rooms → Send invitation emails
```

**Pipeline 5: Live Debate Moderation**
```
Audio stream → STT (Deepgram streaming) → Real-time transcript →
Every N seconds or at turn boundaries:
  - Check claims against reading index (RAG retrieval)
  - Generate follow-up questions if claims are vague/unsupported
  - Push AI moderator messages to frontend via WebSocket
Timer logic → Phase transitions → Signal frontend
```

**Pipeline 6: Post-Debate Evaluation**
```
Full transcript + Student memo + Reading index + Rubric →
LLM evaluation prompt →
Output: {
  score: number,
  confidence: number,
  evidence_of_reading: number,
  breakdown: {
    opening_clarity: number,
    rebuttal_quality: number,
    reading_accuracy: number,
    evidence_use: number
  },
  integrity_flags: string[],
  summary: string (2-3 paragraphs)
}
→ Store in DB → Available on instructor dashboard
```

**Pipeline 7: Instructor Summary**
```
Evaluation output + key transcript moments →
LLM: generate short, actionable narrative →
Highlight notable exchanges, concerns, strengths
```

---

## 6. Data Models

### Users
```
users
├── id (UUID)
├── email
├── name
├── role (student | instructor)
├── course_code
├── created_at
└── updated_at
```

### Assignments
```
assignments
├── id (UUID)
├── title ("Walmart Case")
├── prompt_text (rich text / markdown)
├── rubric_text
├── reading_links (JSON array of {title, url, file_path?})
├── memo_deadline (datetime)
├── debate_deadline (datetime)
├── created_by (instructor user_id)
├── created_at
└── updated_at
```

### Memos
```
memos
├── id (UUID)
├── assignment_id (FK)
├── student_id (FK)
├── file_path (S3 key)
├── extracted_text
├── analysis (JSON: {position, thesis, claims[], citations[], stance_strength})
├── position_binary (net_positive | net_negative | unclassified)
├── status (uploaded | processing | analyzed | error)
├── uploaded_at
└── analyzed_at
```

### Debate Pairings
```
pairings
├── id (UUID)
├── assignment_id (FK)
├── student_a_id (FK) — Net Positive
├── student_b_id (FK) — Net Negative
├── debate_room_url (unique video link)
├── debate_room_id (from video provider)
├── access_code (optional)
├── status (paired | invited | scheduled | in_progress | completed | no_show)
├── email_sent_at
├── reminder_count
├── debate_started_at
├── debate_ended_at
├── created_at
└── updated_at
```

### Debate Sessions
```
debate_sessions
├── id (UUID)
├── pairing_id (FK)
├── transcript (JSON array of {speaker, text, timestamp, phase})
├── recording_path (S3 key)
├── duration_seconds
├── phases_log (JSON: timestamps for each phase transition)
├── ai_interventions (JSON array of {timestamp, type, message})
├── status (active | completed | terminated)
├── started_at
└── ended_at
```

### Evaluations
```
evaluations
├── id (UUID)
├── debate_session_id (FK)
├── student_id (FK)
├── score (numeric)
├── confidence (numeric 0-1)
├── evidence_of_reading_score (numeric 0-100)
├── opening_clarity (numeric)
├── rebuttal_quality (numeric)
├── reading_accuracy (numeric)
├── evidence_use (numeric)
├── integrity_flags (JSON array of strings)
├── ai_summary (text)
├── pass_fail (pass | fail | review)
├── created_at
└── updated_at
```

---

## 7. AI Prompts (Key Templates)

### 7.1 Memo Analysis Prompt
```
You are analyzing a student memo for a university assignment.

ASSIGNMENT PROMPT:
{assignment_prompt}

STUDENT MEMO:
{memo_text}

Extract the following as JSON:
{
  "position": "net_positive" | "net_negative",
  "thesis": "one sentence summary of their main argument",
  "key_claims": ["claim 1", "claim 2", ...],
  "citations": [{"reading": "author/title", "how_used": "summary of usage"}],
  "stance_strength": "strong" | "moderate" | "weak",
  "reasoning": "brief explanation of your classification"
}

Classification rules:
- If the student argues Walmart deserves a Nobel (Economics or Peace) or that Walmart's impact is predominantly positive → "net_positive"
- If the student argues Walmart should "burn in hell" or that negative effects outweigh positives → "net_negative"
- For nuanced/mixed positions, determine which way the overall argument leans and classify accordingly
- Only use "net_positive" or "net_negative" — no middle ground for pairing purposes
```

### 7.2 Live Moderation Prompt
```
You are an AI debate moderator for a university oral defense.

ASSIGNMENT: {assignment_title}
READINGS AVAILABLE: {reading_summaries}
STUDENT A MEMO POSITION: {student_a_thesis}
STUDENT B MEMO POSITION: {student_b_thesis}
CURRENT PHASE: {phase}
RECENT TRANSCRIPT: {last_60_seconds_transcript}

Your role:
1. If a student makes a vague claim, generate a specific follow-up question that forces them to cite a reading
2. If a student misstates a finding from one of the readings, flag it gently
3. Suggest cross-examination questions that probe the weakest parts of each student's argument
4. Keep interventions brief (1-2 sentences max)
5. Only intervene when necessary — let the students drive the conversation

Output JSON:
{
  "should_intervene": true/false,
  "intervention_type": "question" | "flag" | "redirect" | "none",
  "target_student": "A" | "B" | "both",
  "message": "Your intervention text"
}
```

### 7.3 Post-Debate Evaluation Prompt
```
You are evaluating a student's performance in an AI-moderated oral debate.

ASSIGNMENT: {assignment_prompt}
READINGS: {reading_summaries}
STUDENT'S MEMO: {memo_text}
FULL DEBATE TRANSCRIPT: {transcript}
THIS STUDENT IS: {student_identifier}

Evaluate on these dimensions (0-100 each):
1. Opening clarity: Was the opening statement clear, well-structured, and thesis-driven?
2. Rebuttal quality: Did the student effectively counter their opponent's arguments?
3. Reading accuracy: Did the student correctly represent findings from the assigned readings?
4. Evidence use: Did the student cite specific evidence from readings to support claims?

Also assess:
- Evidence-of-reading score (0-100): Overall, how confident are you that this student genuinely read and understood the assigned materials?
- Pass/Fail recommendation with confidence (0-1)
- Integrity flags: Any of these detected?
  * Student couldn't explain a key mechanism they referenced in memo
  * Student couldn't connect claim to reading evidence
  * Student contradicted memo thesis without plausible reason
  * Overly polished but shallow answers that never cite specifics

Output structured JSON with scores, flags, and a 2-3 paragraph summary.
```

---

## 8. Academic Integrity Detection (v1)

The system flags (does not auto-fail) the following patterns:

| Signal | Detection Method |
|--------|-----------------|
| Can't explain own memo's key claim | Compare memo claims to debate transcript — student never elaborates or gets confused when pressed |
| Can't connect claim → reading | Student makes claims from memo but can't cite which paper supports them when asked |
| Contradicts own thesis | Transcript shows student arguing the opposite of their memo without acknowledging the shift |
| Polished but shallow | Memo is highly polished; debate responses are generic and never cite specifics from readings |

These are surfaced as flags to the instructor, not as automated judgments.

---

## 9. Email Templates

### 9.1 Debate Invitation
```
Subject: Your debate for {assignment_title} is ready

Hi {student_name},

You've been paired with a classmate for your oral debate on the {assignment_title} case.

Join your debate here: {debate_link}

Deadline to complete: {debate_deadline}

What to expect:
- A ~15 minute structured debate with an AI moderator
- You'll present your position, respond to your opponent's arguments, and answer follow-up questions
- Make sure you've reviewed the readings — the moderator will ask you to cite specific evidence

Tips:
- Use a quiet space with a stable internet connection
- Have your readings accessible for reference
- A webcam and microphone are required

Questions? Contact {instructor_email}
```

### 9.2 Reminder (if debate hasn't happened)
```
Subject: Reminder: Complete your debate by {deadline}

Hi {student_name},

You haven't completed your debate for {assignment_title} yet.
Your debate link: {debate_link}
Deadline: {debate_deadline}

Please coordinate with your partner to schedule a time.
```

---

## 10. Edge Cases & Error Handling

| Scenario | Handling |
|----------|---------|
| Unreadable PDF (scanned image) | Attempt OCR. If still unreadable, notify student to re-upload a text-based PDF |
| Odd number of students | Last student goes unpaired. Options: pair with AI opponent (v2), create a 3-person group, or wait for late submission |
| Student no-show for debate | Send reminders. After deadline, flag for instructor. Consider retake policy (TBD) |
| Student goes off-topic | AI moderator redirects: "Let's bring this back to the readings. {Specific question}" |
| Student can't fill their time | AI asks a follow-up question to help them continue. If still struggling, move to next phase |
| Student talks past their time | Visual + audio warning at 15 seconds remaining. Hard cutoff with mic mute at +10 seconds grace |
| Both students agree (same position after reclassification) | Rare if pairing works correctly. Fallback: have them steel-man the opposing view |
| Video/audio technical failure | Auto-retry connection. If persistent, save partial transcript, flag for instructor review, allow reschedule |
| Student uploads wrong file | Allow re-upload before deadline. New upload replaces previous |

---

## 11. Privacy & Compliance

- **Consent**: Before debate session starts, explicit consent screen for recording and transcription. Both students must accept.
- **Recording retention**: Raw video deleted after 30 days (configurable). Transcripts + AI summaries retained for the semester.
- **Access control**: Students see only their own status. Instructors see all students in their course.
- **FERPA alignment**: Student educational records handled per Columbia's FERPA guidelines. No data shared outside the platform without authorization.
- **Data storage**: All data encrypted at rest and in transit. Hosted in US region.

---

## 12. Milestones (Proposed 6-Week Sprint)

| Week | Deliverable | Details |
|------|-------------|---------|
| **1-2** | Assignment + Upload scaffolding | Auth, dashboard, assignment detail page, memo upload flow, file storage |
| **3** | Memo parsing + pairing | Text extraction, LLM analysis, position classification, pairing algorithm, email notifications |
| **4** | Video session (basic) | Daily.co integration, room creation, debate UI with timer/phases, basic recording |
| **5** | AI moderation + evaluation | STT integration, RAG over readings, live moderation logic, post-debate evaluation pipeline |
| **6** | Instructor dashboard + pilot | Results display, transcript viewer, score export, bug fixes, pilot with first cohort |

---

## 13. Open Decisions (Must Resolve Before Build)

| # | Question | Impact | Suggested Default |
|---|----------|--------|-------------------|
| 1 | SSO or course code for pilot? | Auth implementation | Course code for pilot, SSO for v2 |
| 2 | Readings hosted in-app or external links? | Storage + viewer work | External links for v1 |
| 3 | Pass/fail advisory or grade-impacting? | UI + instructor workflow | Advisory for v1 |
| 4 | Retake policy? | Scheduling + pairing logic | 1 retake allowed, instructor-approved |
| 5 | Can students use AI for memo drafting? | Integrity detection tuning | Yes, if they can defend orally |
| 6 | Cross-examination duration? | Timer logic | 3 minutes per student |
| 7 | Video provider? | Core infrastructure | Daily.co for MVP |
| 8 | Who handles scheduling? | UX complexity | Students self-schedule within deadline window |
| 9 | What if student disputes their position classification? | UX flow | Allow student to flag; instructor resolves |

---

## 14. Pilot Parameters

- **Students**: ~27 (based on Walmart case pilot data)
- **Debates**: ~13 sessions (12 pairs + 1-2 edge cases)
- **Video minutes**: ~13 debates × 15 min × 2 participants = ~390 participant-minutes (well within Daily.co free tier)
- **LLM calls**: ~27 memo analyses + ~13 × ~20 moderation calls + ~27 evaluations ≈ 314 API calls
- **30 hours of video call time included** in the contract; this covers approximately 120 fifteen-minute debates

---

## 15. Cost Estimate (MVP Pilot)

| Item | Provider | Est. Cost |
|------|----------|-----------|
| Video calls | Daily.co | Free (under 10K participant-min/month) |
| Transcription (STT) | Deepgram | ~$0.0043/min → ~$1.70 for pilot |
| LLM (memo analysis + moderation + eval) | Claude/GPT-4 | ~$15-30 for pilot |
| Hosting | Vercel (frontend) + Railway/Fly.io (backend) | ~$20-40/month |
| Database | Supabase or Railway Postgres | Free tier or ~$10/month |
| File storage | S3 | ~$1/month |
| Email | Resend | Free tier (100 emails/day) |
| **Total for pilot** | | **~$50-80/month** |

---

## Appendix A: Walmart Case — Assignment Prompt

> **WEEK 2: Scale-Ups vs SMEs**
>
> Which of these creates more jobs and more GDP growth? Why do we talk so much about startups? This class offers a top-down vision of how entrepreneurs can have an economic impact that moves the needle. Which is better for a country like the US: One Walmart Corporation or 2-million independent self-employed retail entrepreneurs?
>
> **Mandatory Readings:**
> 1. Basker, E. (2005). "Job Creation or Destruction? Labor Market Effects of Wal-Mart Expansion." *Review of Economics and Statistics*, 87(1), 174-183.
> 2. Neumark, D., Zhang, J., & Ciccarella, S. (2008). "The effects of Wal-Mart on local labor markets." *Journal of Urban Economics*, 63, 405-430.
> 3. Isenberg, D. & Fabre, F. (2014). "Don't Judge The Economy By The Number Of Startups." *Harvard Business Review*.
>
> **Assignment:** One page response to the question: Should Walmart get the Nobel in Economics, in Peace, both, or burn in hell?

## Appendix B: Pilot Classification Data

From the 27-student pilot:

| Position | Original Count | After Reclassification |
|----------|---------------|----------------------|
| Net Positive (🟢 + reclassified 🟡) | 7 + 5 = 12 | 12 |
| Net Negative (🔴 + reclassified 🟡) | 10 + 4 = 14 | 14 |
| Unreadable | 1 | excluded |
| **Total pairable** | | **26** → **13 pairs** |

Reclassification notes: Mixed/Nuanced students were reclassified based on the overall lean of their argument. For example, a student who says "Walmart has undisputable positives but doesn't deserve the Nobel" was reclassified as Net Positive because their framing leads with positives.

## Appendix C: Example Debate Pairing Logic

```
Input: All memos with position_binary = net_positive OR net_negative

Algorithm:
1. Separate into two pools: positives[], negatives[]
2. Sort each pool by stance_strength (weakest first)
3. For each positive[i], pair with negative[i]
   - Prefer pairing students with DIFFERENT core arguments
   - e.g., a student arguing "job creation" pairs with one arguing "wage suppression" (not "job displacement")
4. If pools are unequal, leftover students are flagged for instructor review
5. Output: list of {student_a_id, student_b_id, matchmaking_reasoning}
```
