CREATE TYPE "public"."capability_id" AS ENUM('journey-studio', 'resume-anywhere', 'live-signal-inbox', 'ai-incident-analyst', 'recovery-plan-composer', 'trust-and-approval-desk', 'recovery-runner', 'evidence-and-outcomes');--> statement-breakpoint
CREATE TYPE "public"."capability_status" AS ENUM('registered');--> statement-breakpoint
CREATE TABLE "capability" (
	"id" "capability_id" PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"summary" text NOT NULL,
	"status" "capability_status" DEFAULT 'registered' NOT NULL,
	"sort_order" integer NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "capability_sort_order_unique" UNIQUE("sort_order")
);
--> statement-breakpoint
CREATE TABLE "platform_release" (
	"id" text PRIMARY KEY NOT NULL,
	"product_name" text NOT NULL,
	"product_version" text NOT NULL,
	"tagline" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
