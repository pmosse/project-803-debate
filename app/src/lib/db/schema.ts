import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  numeric,
  pgEnum,
  vector,
  index,
} from "drizzle-orm/pg-core";

// Enums
export const userRoleEnum = pgEnum("user_role", ["student", "professor", "super_admin"]);
export const memoStatusEnum = pgEnum("memo_status", [
  "uploaded",
  "extracting",
  "analyzing",
  "analyzed",
  "error",
]);
export const positionEnum = pgEnum("position_binary", [
  "net_positive",
  "net_negative",
  "unclassified",
]);
export const pairingStatusEnum = pgEnum("pairing_status", [
  "paired",
  "invited",
  "in_progress",
  "completed",
  "no_show",
]);
export const debateSessionStatusEnum = pgEnum("debate_session_status", [
  "waiting",
  "active",
  "completed",
  "terminated",
]);
export const passfailEnum = pgEnum("pass_fail", ["pass", "fail", "review"]);

// Users
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email"),
  name: text("name").notNull(),
  role: userRoleEnum("role").notNull().default("student"),
  courseCode: text("course_code"),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Classes
export const classes = pgTable("classes", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Class Memberships
export const classMemberships = pgTable("class_memberships", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  classId: uuid("class_id")
    .references(() => classes.id)
    .notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

// Assignments
export const assignments = pgTable("assignments", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  promptText: text("prompt_text").notNull(),
  rubricText: text("rubric_text"),
  rubricCriteria: jsonb("rubric_criteria").$type<
    { name: string; description: string; maxPoints: number }[]
  >(),
  readingLinks: jsonb("reading_links").$type<
    { title: string; url: string }[]
  >(),
  memoDeadline: timestamp("memo_deadline"),
  debateDeadline: timestamp("debate_deadline"),
  classId: uuid("class_id").references(() => classes.id),
  courseCode: text("course_code").notNull(),
  emailDomain: text("email_domain"),
  accessCode: text("access_code"),
  createdBy: uuid("created_by")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Memos
export const memos = pgTable("memos", {
  id: uuid("id").defaultRandom().primaryKey(),
  assignmentId: uuid("assignment_id")
    .references(() => assignments.id)
    .notNull(),
  studentId: uuid("student_id")
    .references(() => users.id)
    .notNull(),
  filePath: text("file_path"),
  extractedText: text("extracted_text"),
  analysis: jsonb("analysis").$type<{
    position: string;
    thesis: string;
    key_claims: string[];
    citations: { reading: string; how_used: string }[];
    stance_strength: string;
    reasoning: string;
  }>(),
  positionBinary: positionEnum("position_binary").default("unclassified"),
  studentConfirmed: integer("student_confirmed").default(0),
  status: memoStatusEnum("status").default("uploaded").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  analyzedAt: timestamp("analyzed_at"),
});

// Pairings
export const pairings = pgTable("pairings", {
  id: uuid("id").defaultRandom().primaryKey(),
  assignmentId: uuid("assignment_id")
    .references(() => assignments.id)
    .notNull(),
  studentAId: uuid("student_a_id")
    .references(() => users.id)
    .notNull(),
  studentBId: uuid("student_b_id")
    .references(() => users.id)
    .notNull(),
  debateRoomUrl: text("debate_room_url"),
  debateRoomId: text("debate_room_id"),
  accessCode: text("access_code"),
  matchmakingReason: text("matchmaking_reason"),
  status: pairingStatusEnum("status").default("paired").notNull(),
  emailSentAt: timestamp("email_sent_at"),
  reminderCount: integer("reminder_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Debate Sessions
export const debateSessions = pgTable("debate_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  pairingId: uuid("pairing_id")
    .references(() => pairings.id)
    .notNull(),
  transcript: jsonb("transcript").$type<
    { speaker: string; text: string; timestamp: number; phase: string }[]
  >(),
  recordingPath: text("recording_path"),
  durationSeconds: integer("duration_seconds"),
  phasesLog: jsonb("phases_log").$type<
    { phase: string; startedAt: number; endedAt?: number }[]
  >(),
  aiInterventions: jsonb("ai_interventions").$type<
    { timestamp: number; type: string; message: string }[]
  >(),
  consentA: integer("consent_a").default(0),
  consentB: integer("consent_b").default(0),
  status: debateSessionStatusEnum("status").default("waiting").notNull(),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
});

// Evaluations
export const evaluations = pgTable("evaluations", {
  id: uuid("id").defaultRandom().primaryKey(),
  debateSessionId: uuid("debate_session_id")
    .references(() => debateSessions.id)
    .notNull(),
  studentId: uuid("student_id")
    .references(() => users.id)
    .notNull(),
  score: numeric("score"),
  confidence: numeric("confidence"),
  evidenceOfReadingScore: numeric("evidence_of_reading_score"),
  openingClarity: numeric("opening_clarity"),
  rebuttalQuality: numeric("rebuttal_quality"),
  readingAccuracy: numeric("reading_accuracy"),
  evidenceUse: numeric("evidence_use"),
  integrityFlags: jsonb("integrity_flags").$type<string[]>(),
  criteriaScores: jsonb("criteria_scores").$type<
    { criterion: string; score: number; maxPoints: number; reasoning: string }[]
  >(),
  aiSummary: text("ai_summary"),
  passFail: passfailEnum("pass_fail"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Reading Chunks (for RAG)
export const readingChunks = pgTable(
  "reading_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assignmentId: uuid("assignment_id")
      .references(() => assignments.id)
      .notNull(),
    sourceTitle: text("source_title").notNull(),
    chunkText: text("chunk_text").notNull(),
    embedding: vector("embedding", { dimensions: 384 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("reading_chunks_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops")
    ),
  ]
);

// Assignment Enrollments (student signup)
export const assignmentEnrollments = pgTable("assignment_enrollments", {
  id: uuid("id").defaultRandom().primaryKey(),
  assignmentId: uuid("assignment_id")
    .references(() => assignments.id)
    .notNull(),
  studentId: uuid("student_id")
    .references(() => users.id)
    .notNull(),
  availability: jsonb("availability").$type<Record<string, string[]>>(),
  enrolledAt: timestamp("enrolled_at").defaultNow().notNull(),
});

// Email Verifications (signup flow)
export const emailVerifications = pgTable("email_verifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  code: text("code").notNull(),
  assignmentId: uuid("assignment_id")
    .references(() => assignments.id)
    .notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  verified: integer("verified").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// AI Usage tracking
export const aiUsageServiceEnum = pgEnum("ai_usage_service", [
  "claude",
  "deepgram",
]);

export const aiUsage = pgTable("ai_usage", {
  id: uuid("id").defaultRandom().primaryKey(),
  assignmentId: uuid("assignment_id").references(() => assignments.id),
  pairingId: uuid("pairing_id").references(() => pairings.id),
  memoId: uuid("memo_id").references(() => memos.id),
  service: aiUsageServiceEnum("service").notNull(),
  model: text("model"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  durationSeconds: numeric("duration_seconds"),
  estimatedCost: numeric("estimated_cost"),
  callType: text("call_type").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Assignment = typeof assignments.$inferSelect;
export type NewAssignment = typeof assignments.$inferInsert;
export type Memo = typeof memos.$inferSelect;
export type NewMemo = typeof memos.$inferInsert;
export type Pairing = typeof pairings.$inferSelect;
export type NewPairing = typeof pairings.$inferInsert;
export type DebateSession = typeof debateSessions.$inferSelect;
export type Evaluation = typeof evaluations.$inferSelect;
export type ReadingChunk = typeof readingChunks.$inferSelect;
export type AssignmentEnrollment = typeof assignmentEnrollments.$inferSelect;
export type EmailVerification = typeof emailVerifications.$inferSelect;
export type AiUsage = typeof aiUsage.$inferSelect;
export type Class = typeof classes.$inferSelect;
export type NewClass = typeof classes.$inferInsert;
export type ClassMembership = typeof classMemberships.$inferSelect;
