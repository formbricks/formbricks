/**
 * Save-time limits on a workflow definition (spec §10). Saving a definition over any of them is
 * refused (400 through API v3 and MCP); the runner never re-checks them, so a definition stored
 * before a limit existed keeps running.
 *
 * `maxHttpHeaders`, `maxHttpUrlBytes` and `maxHttpBodyTemplateBytes` are for the HTTP request
 * action (ENG-7179), which applies them in its own schema; its run-time caps are
 * `WORKFLOW_HTTP_RUN_LIMITS` below.
 */
export const WORKFLOW_LIMITS = {
  /** Steps (nodes after the trigger) per workflow. The editor's add-step menu disables at this. */
  maxSteps: 25,
  /** Leaf conditions per If/else, nested groups included. */
  maxConditionsPerIfElse: 20,
  maxHttpHeaders: 30,
  maxHttpUrlBytes: 2 * 1024,
  maxHttpBodyTemplateBytes: 100 * 1024,
} as const;

/**
 * What one HTTP request step call may take when it runs (spec §10, ENG-7168), applied by the sender in
 * `apps/web` (`lib/http-request/`). Kept beside the save-time HTTP limits so every HTTP request cap is
 * in one place.
 */
export const WORKFLOW_HTTP_RUN_LIMITS = {
  /** Per attempt. */
  timeoutMs: 10_000,
  /** Response bytes read; the rest is never downloaded. */
  maxResponseBytes: 1024 * 1024,
  /** Retries after the first attempt, for timeouts, network errors, 429 and 5xx. */
  retries: 3,
  /** Request and response body bytes run detail and samples keep. */
  loggedBodyBytes: 64 * 1024,
} as const;
