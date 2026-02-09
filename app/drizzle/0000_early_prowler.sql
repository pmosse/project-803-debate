CREATE TYPE "public"."debate_session_status" AS ENUM('waiting', 'active', 'completed', 'terminated');--> statement-breakpoint
CREATE TYPE "public"."memo_status" AS ENUM('uploaded', 'extracting', 'analyzing', 'analyzed', 'error');--> statement-breakpoint
CREATE TYPE "public"."pairing_status" AS ENUM('paired', 'invited', 'in_progress', 'completed', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."pass_fail" AS ENUM('pass', 'fail', 'review');--> statement-breakpoint
CREATE TYPE "public"."position_binary" AS ENUM('net_positive', 'net_negative', 'unclassified');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('student', 'instructor');--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"prompt_text" text NOT NULL,
	"rubric_text" text,
	"reading_links" jsonb,
	"memo_deadline" timestamp,
	"debate_deadline" timestamp,
	"course_code" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debate_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pairing_id" uuid NOT NULL,
	"transcript" jsonb,
	"recording_path" text,
	"duration_seconds" integer,
	"phases_log" jsonb,
	"ai_interventions" jsonb,
	"consent_a" integer DEFAULT 0,
	"consent_b" integer DEFAULT 0,
	"status" "debate_session_status" DEFAULT 'waiting' NOT NULL,
	"started_at" timestamp,
	"ended_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"debate_session_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"score" numeric,
	"confidence" numeric,
	"evidence_of_reading_score" numeric,
	"opening_clarity" numeric,
	"rebuttal_quality" numeric,
	"reading_accuracy" numeric,
	"evidence_use" numeric,
	"integrity_flags" jsonb,
	"ai_summary" text,
	"pass_fail" "pass_fail",
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"file_path" text,
	"extracted_text" text,
	"analysis" jsonb,
	"position_binary" "position_binary" DEFAULT 'unclassified',
	"student_confirmed" integer DEFAULT 0,
	"status" "memo_status" DEFAULT 'uploaded' NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"analyzed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "pairings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"student_a_id" uuid NOT NULL,
	"student_b_id" uuid NOT NULL,
	"debate_room_url" text,
	"debate_room_id" text,
	"access_code" text,
	"matchmaking_reason" text,
	"status" "pairing_status" DEFAULT 'paired' NOT NULL,
	"email_sent_at" timestamp,
	"reminder_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reading_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"source_title" text NOT NULL,
	"chunk_text" text NOT NULL,
	"embedding" vector(384),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text,
	"name" text NOT NULL,
	"role" "user_role" DEFAULT 'student' NOT NULL,
	"course_code" text,
	"password_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debate_sessions" ADD CONSTRAINT "debate_sessions_pairing_id_pairings_id_fk" FOREIGN KEY ("pairing_id") REFERENCES "public"."pairings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_debate_session_id_debate_sessions_id_fk" FOREIGN KEY ("debate_session_id") REFERENCES "public"."debate_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memos" ADD CONSTRAINT "memos_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memos" ADD CONSTRAINT "memos_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairings" ADD CONSTRAINT "pairings_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairings" ADD CONSTRAINT "pairings_student_a_id_users_id_fk" FOREIGN KEY ("student_a_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairings" ADD CONSTRAINT "pairings_student_b_id_users_id_fk" FOREIGN KEY ("student_b_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_chunks" ADD CONSTRAINT "reading_chunks_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reading_chunks_embedding_idx" ON "reading_chunks" USING hnsw ("embedding" vector_cosine_ops);