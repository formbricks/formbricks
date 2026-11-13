/**
 * The values a run can name with a Variable path (ADR 0045), built up as the run walks its graph.
 *
 * - `payload`: the JSON a Webhook trigger received (absent for other triggers).
 * - `response`: the survey answers of a Response completed run, keyed by question / hidden field id.
 * - `steps`: each finished step's output, keyed by step id, so renaming a step breaks nothing.
 */
export interface TWorkflowRunContext {
  payload?: Record<string, unknown>;
  response?: { data: Record<string, unknown> };
  steps: Record<string, Record<string, unknown>>;
}
