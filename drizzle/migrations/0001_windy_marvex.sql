CREATE TYPE "public"."journey_origin" AS ENUM('operator', 'sandbox');--> statement-breakpoint
CREATE TYPE "public"."journey_template_key" AS ENUM('vendor-onboarding', 'service-intake');--> statement-breakpoint
CREATE TABLE "journey_definition" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"origin" "journey_origin" NOT NULL,
	"template_key" "journey_template_key",
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"sandbox_notice" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "journey_definition_slug_unique" UNIQUE("slug"),
	CONSTRAINT "journey_definition_origin_shape" CHECK ((
        "journey_definition"."origin" = 'sandbox'
        and "journey_definition"."template_key" is not null
        and "journey_definition"."sandbox_notice" is not null
        and length(trim("journey_definition"."sandbox_notice")) > 0
      ) or (
        "journey_definition"."origin" = 'operator'
        and "journey_definition"."template_key" is null
        and "journey_definition"."sandbox_notice" is null
      ))
);
--> statement-breakpoint
CREATE TABLE "journey_draft" (
	"journey_id" uuid PRIMARY KEY NOT NULL,
	"revision" integer NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"entry_step_id" text NOT NULL,
	"steps" jsonb NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"based_on_version" integer,
	CONSTRAINT "journey_draft_revision_positive" CHECK ("journey_draft"."revision" >= 1)
);
--> statement-breakpoint
CREATE TABLE "journey_version" (
	"id" uuid PRIMARY KEY NOT NULL,
	"journey_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"entry_step_id" text NOT NULL,
	"steps" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"published_by" text NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "journey_version_journey_number_unique" UNIQUE("journey_id","version_number"),
	CONSTRAINT "journey_version_number_positive" CHECK ("journey_version"."version_number" >= 1),
	CONSTRAINT "journey_version_hash_sha256" CHECK ("journey_version"."content_hash" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "journey_draft" ADD CONSTRAINT "journey_draft_journey_id_journey_definition_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."journey_definition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_version" ADD CONSTRAINT "journey_version_journey_id_journey_definition_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."journey_definition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "journey_definition_template_key_unique" ON "journey_definition" USING btree ("template_key") WHERE "journey_definition"."template_key" is not null;--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."journey_version_reject_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'journey_version rows are immutable'
    USING ERRCODE = '55000';
END;
$$;--> statement-breakpoint
CREATE TRIGGER "journey_version_no_update"
BEFORE UPDATE ON "journey_version"
FOR EACH ROW
EXECUTE FUNCTION "public"."journey_version_reject_mutation"();--> statement-breakpoint
CREATE TRIGGER "journey_version_no_delete"
BEFORE DELETE ON "journey_version"
FOR EACH ROW
EXECUTE FUNCTION "public"."journey_version_reject_mutation"();