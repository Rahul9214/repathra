export const RUN_MESSAGES = {
  auth_not_configured: "Authentication is not configured in this environment.",
  unauthenticated: "You must be signed in to access or run journeys.",
  unauthorized: "You do not have permission to access this journey run.",
  run_not_found: "The requested journey run could not be found.",
  version_not_found: "The specified published journey version could not be found.",
  draft_runs_forbidden: "Runs cannot be started against editable drafts. Only published versions can be run.",
  run_already_completed: "This journey run has already completed and cannot be transitioned further.",
  step_paused_waiting_for_signal:
    "This journey is paused waiting for an external signal from Live Signal Inbox. It cannot be advanced manually.",
  step_paused_waiting_for_handoff:
    "This journey is paused waiting for authorized handoff. It cannot be bypassed or simulated.",
  revision_conflict:
    "Conflict detected: This run was updated by another session or device. Please refresh to view the latest state.",
  invalid_step_type: "The submitted action does not match the current step type.",
  current_step_not_found: "The current step could not be found in the frozen journey document.",
  next_step_not_found: "The next transition step could not be found in the frozen journey document.",
  missing_required_field: "This field is required to continue.",
  review_acknowledgment_required: "You must acknowledge the review to proceed.",
  invalid_decision_outcome: "Selected decision outcome is not valid for this step.",
  database_not_configured: "Database connection is not configured.",
  database_unreachable: "Database could not be reached.",
  schema_not_migrated: "Database schema has not been migrated for journey runs.",
  run_started: "Journey started successfully.",
  step_advanced: "Step completed and saved to database.",
} as const;
