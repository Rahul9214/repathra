CREATE TYPE "public"."journey_run_status" AS ENUM('active', 'paused', 'completed');--> statement-breakpoint
CREATE TABLE "journey_run" (
	"id" uuid PRIMARY KEY NOT NULL,
	"journey_id" uuid NOT NULL,
	"journey_version_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"content_hash" text NOT NULL,
	"owner_id" text NOT NULL,
	"current_step_id" text NOT NULL,
	"status" "journey_run_status" DEFAULT 'active' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"collected_values" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"completed_step_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"completed_outcome" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "journey_run_revision_positive" CHECK ("journey_run"."revision" >= 1),
	CONSTRAINT "journey_run_version_number_positive" CHECK ("journey_run"."version_number" >= 1),
	CONSTRAINT "journey_run_hash_sha256" CHECK ("journey_run"."content_hash" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE "journey_run_event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"sequence_number" integer NOT NULL,
	"event_type" text NOT NULL,
	"from_step_id" text,
	"to_step_id" text NOT NULL,
	"action" jsonb,
	"idempotency_key" text,
	"actor_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "journey_run_event_run_seq_unique" UNIQUE("run_id","sequence_number")
);
--> statement-breakpoint
ALTER TABLE "journey_run" ADD CONSTRAINT "journey_run_journey_id_journey_definition_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."journey_definition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_run" ADD CONSTRAINT "journey_run_journey_version_id_journey_version_id_fk" FOREIGN KEY ("journey_version_id") REFERENCES "public"."journey_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_run_event" ADD CONSTRAINT "journey_run_event_run_id_journey_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."journey_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "journey_run_owner_updated_idx" ON "journey_run" USING btree ("owner_id","updated_at");--> statement-breakpoint
CREATE INDEX "journey_run_journey_version_idx" ON "journey_run" USING btree ("journey_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "journey_run_event_idempotency_unique" ON "journey_run_event" USING btree ("run_id","idempotency_key") WHERE "journey_run_event"."idempotency_key" is not null;--> statement-breakpoint
CREATE INDEX "journey_run_event_run_idx" ON "journey_run_event" USING btree ("run_id");