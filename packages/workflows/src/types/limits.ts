/**
 * Save-time limits on a workflow definition (spec §10). Saving a definition over any of them is
 * refused (400 through API v3 and MCP); the runner never re-checks them, so a definition stored
 * before a limit existed keeps running.
 *
 * `maxHttpHeaders`, `maxHttpUrlBytes` and `maxHttpBodyTemplateBytes` are for the HTTP request
 * action (ENG-7179), which applies them in its own schema.
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
