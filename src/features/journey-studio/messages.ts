export const JOURNEY_MESSAGES = {
  auth_not_configured: "Operator authentication is not configured. Editing and publishing are closed.",
  unauthenticated: "Sign in is required before a journey can be edited or published.",
  unauthorized: "Operator authorization is required. This account does not have operator permissions.",
  unchanged_draft: "This draft matches the latest published version. Nothing new was published.",
  revision_conflict: "The draft changed before this save. Reload the journey and try again.",
  not_found: "That journey is not stored.",
  version_not_found: "That published version is not stored.",
  slug_taken: "A journey with this slug is already stored.",
  slug_reserved: "This slug is reserved for a synthetic sandbox journey.",
  database_not_configured:
    "DATABASE_URL is not set. Journey Studio did not open a database connection.",
  database_unreachable: "Journey Studio could not reach the database. No change was stored.",
  schema_not_migrated:
    "The journey tables are not migrated. Run pnpm db:migrate against the development database.",
  invalid_document: "The journey document did not pass validation.",
  draft_saved: "Draft saved.",
  published: "Published an immutable version.",
  created: "Journey created.",
  stored_journey_invalid: "A stored journey failed validation and was not returned.",
} as const;

export type JourneyMessageCode = keyof typeof JOURNEY_MESSAGES;
