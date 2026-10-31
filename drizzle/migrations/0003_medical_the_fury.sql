CREATE TYPE "public"."failure_category" AS ENUM('http_4xx', 'http_5xx', 'timeout', 'network_error', 'tls_error', 'payload_error');--> statement-breakpoint
CREATE TYPE "public"."incident_severity" AS ENUM('critical', 'high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."incident_status" AS ENUM('open', 'acknowledged', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."signal_provenance" AS ENUM('observed_http', 'authenticated_webhook', 'diagnostic');--> statement-breakpoint
CREATE TABLE "incident" (
	"id" uuid PRIMARY KEY NOT NULL,
	"fingerprint" text NOT NULL,
	"title" text NOT NULL,
	"source" text NOT NULL,
	"operation" text NOT NULL,
	"signal_key" text,
	"severity" "incident_severity" NOT NULL,
	"status" "incident_status" DEFAULT 'open' NOT NULL,
	"occurrence_count" integer DEFAULT 1 NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"acknowledged_by" text,
	"resolved_at" timestamp with time zone,
	"resolved_by" text,
	"resolution_note" text,
	CONSTRAINT "incident_occurrence_count_positive" CHECK ("incident"."occurrence_count" >= 1)
);
--> statement-breakpoint
CREATE TABLE "incident_event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"incident_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"actor_id" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signal" (
	"id" uuid PRIMARY KEY NOT NULL,
	"incident_id" uuid NOT NULL,
	"provenance" "signal_provenance" NOT NULL,
	"source" text NOT NULL,
	"operation" text NOT NULL,
	"signal_key" text,
	"run_id" uuid,
	"http_method" text NOT NULL,
	"http_url" text NOT NULL,
	"http_status" integer,
	"duration_ms" integer NOT NULL,
	"failure_category" "failure_category" NOT NULL,
	"correlation_id" text,
	"idempotency_key" text,
	"telemetry" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signal_duration_non_negative" CHECK ("signal"."duration_ms" >= 0)
);
--> statement-breakpoint
ALTER TABLE "incident_event" ADD CONSTRAINT "incident_event_incident_id_incident_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incident"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signal" ADD CONSTRAINT "signal_incident_id_incident_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incident"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signal" ADD CONSTRAINT "signal_run_id_journey_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."journey_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "incident_status_severity_idx" ON "incident" USING btree ("status","severity");--> statement-breakpoint
CREATE INDEX "incident_fingerprint_idx" ON "incident" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "incident_last_seen_idx" ON "incident" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "incident_signal_key_idx" ON "incident" USING btree ("signal_key");--> statement-breakpoint
CREATE INDEX "incident_event_incident_created_idx" ON "incident_event" USING btree ("incident_id","created_at");--> statement-breakpoint
CREATE INDEX "signal_incident_occurred_idx" ON "signal" USING btree ("incident_id","occurred_at");--> statement-breakpoint
CREATE INDEX "signal_run_idx" ON "signal" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "signal_idempotency_key_unique" ON "signal" USING btree ("idempotency_key") WHERE "signal"."idempotency_key" is not null;