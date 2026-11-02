import { describe, expect, test, vi } from "vitest";

/**
 * Every MCP tool's annotations agree with its name and its scopes.
 *
 * Annotations are hand-set on each registration, and "Honest annotations" in
 * `docs/development/technical-handbook/mcp-server.mdx` did not hold them: new write tools shipped with
 * `destructiveHint: false` on overwrites and removals (`update_chart`, `remove_chart_from_dashboard`,
 * `archive_workflow`), which tells MCP clients they need no confirmation. This walks every registration
 * across the tool modules, so a new tool is checked without anyone adding it to a list.
 */

type TRegistration = {
  name: string;
  annotations: { readOnlyHint?: unknown; destructiveHint?: unknown } | undefined;
  scopes: string[];
};

const registrations = vi.hoisted((): TRegistration[] => []);

vi.mock("./guard-scopes", () => ({
  registerScopedTool: (
    _server: unknown,
    name: string,
    config: { annotations?: TRegistration["annotations"] },
    scopes: string[] | { anyOf: string[] }
  ) => {
    registrations.push({
      name,
      annotations: config.annotations,
      scopes: Array.isArray(scopes) ? scopes : scopes.anyOf,
    });
  },
}));
// Importing the real response operations pulls in modules that do not load under the unit setup; the
// annotations under test do not depend on them.
vi.mock("@/app/api/v3/responses/lib/operations", () => ({}));
vi.mock("@/app/api/v3/responses/lib/validate-operations", () => ({}));

/** A tool named with one of these verbs overwrites or removes something. */
const DESTRUCTIVE_VERBS = [
  "update_",
  "patch_",
  "edit_",
  "set_",
  "delete_",
  "batch_delete_",
  "remove_",
  "archive_",
];
/** A tool named with one of these verbs only reads. */
const READ_VERBS = ["list_", "get_", "count_", "search_", "find_", "preview_"];

/** Destructive-sounding tools whose previous value stays recoverable, so they are not destructive. */
const RECOVERABLE: Record<string, string> = {
  patch_workspace_custom_css: "the replaced CSS stays recoverable as `previous` until the next change",
};

const loadRegistrations = async (): Promise<TRegistration[]> => {
  const [surveys, workflows, workspaces, feedbackRecords, responses, creatives, dashboards] =
    await Promise.all([
      import("./surveys"),
      import("./workflows"),
      import("./workspaces"),
      import("./feedback-records"),
      import("./responses"),
      import("./creatives"),
      import("./dashboards"),
    ]);
  const server = { registerTool: vi.fn() } as unknown as Parameters<typeof surveys.registerSurveyTools>[0];
  surveys.registerSurveyTools(server);
  workflows.registerWorkflowTools(server);
  workspaces.registerWorkspaceTools(server);
  feedbackRecords.registerFeedbackRecordTools(server);
  responses.registerResponseTools(server);
  creatives.registerCreativeTools(server);
  dashboards.registerDashboardTools(server);
  return registrations;
};

const startsWithAny = (name: string, prefixes: string[]): boolean => prefixes.some((p) => name.startsWith(p));

describe("MCP tool annotations", () => {
  test("agree with each tool's name and scopes", { timeout: 120_000 }, async () => {
    const tools = await loadRegistrations();
    expect(tools.length).toBeGreaterThan(50);

    const problems = tools.flatMap(({ name, annotations, scopes }) => {
      const readOnly = annotations?.readOnlyHint;
      const destructive = annotations?.destructiveHint;
      const found: string[] = [];
      if (typeof readOnly !== "boolean" || typeof destructive !== "boolean") {
        found.push(`${name}: readOnlyHint and destructiveHint must both be set`);
        return found;
      }
      if (!readOnly && !scopes.some((scope) => scope.endsWith(":write"))) {
        found.push(`${name}: writes but is not gated by a :write scope`);
      }
      if (readOnly && destructive) {
        found.push(`${name}: cannot be both read-only and destructive`);
      }
      if (startsWithAny(name, READ_VERBS) && !readOnly) {
        found.push(`${name}: a read verb must be readOnlyHint: true`);
      }
      if (startsWithAny(name, DESTRUCTIVE_VERBS) && !destructive && !(name in RECOVERABLE)) {
        found.push(
          `${name}: overwrites or removes, so destructiveHint must be true (or list it in RECOVERABLE)`
        );
      }
      return found;
    });

    expect(problems).toEqual([]);
  });

  test("every RECOVERABLE entry names a registered tool", { timeout: 120_000 }, async () => {
    const names = new Set((await loadRegistrations()).map(({ name }) => name));
    expect(Object.keys(RECOVERABLE).filter((name) => !names.has(name))).toEqual([]);
  });
});
