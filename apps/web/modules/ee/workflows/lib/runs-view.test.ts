import { describe, expect, test } from "vitest";
import type { TWorkflowDefinition } from "@formbricks/workflows";
import type { TRunDetailRow } from "./run-detail-rows";
import {
  getRunCanvasBadges,
  getTestInputKind,
  getWorkflowRunsPath,
  pickRunGraph,
  resolveShownRunId,
  toRunsViewListFilters,
} from "./runs-view";

// trigger → branch; branch.then → email; branch.else → http
const definition = {
  trigger: { id: "trigger" },
  nodes: [{ id: "branch" }, { id: "email" }, { id: "http" }],
  edges: [],
} as unknown as TWorkflowDefinition;

const draft = { ...definition, nodes: [{ id: "branch" }] } as unknown as TWorkflowDefinition;

const stepRow = (stepId: string, badge: string) =>
  ({ kind: "send_email", stepId, badge }) as unknown as TRunDetailRow;

describe("getWorkflowRunsPath", () => {
  test("is the workflow's Runs tab", () => {
    expect(getWorkflowRunsPath("ws1", "wf1")).toBe("/workspaces/ws1/workflows/wf1/runs");
  });
});

describe("toRunsViewListFilters", () => {
  test("lists every run of the workflow, or only live or only Test runs", () => {
    expect(toRunsViewListFilters("wf1", "all")).toEqual({ workflowId: "wf1" });
    expect(toRunsViewListFilters("wf1", "live")).toEqual({ workflowId: "wf1", isDryRun: false });
    expect(toRunsViewListFilters("wf1", "test")).toEqual({ workflowId: "wf1", isDryRun: true });
  });
});

describe("resolveShownRunId", () => {
  test("shows the run in the URL, else the newest listed, else none", () => {
    expect(resolveShownRunId("r9", [{ id: "r1" }])).toBe("r9");
    expect(resolveShownRunId(null, [{ id: "r1" }, { id: "r0" }])).toBe("r1");
    expect(resolveShownRunId(null, [])).toBeNull();
  });
});

describe("getRunCanvasBadges", () => {
  test("marks every step of the graph: what the run did, and Didn't run where it never got", () => {
    const badges = getRunCanvasBadges(definition, [
      { kind: "trigger" } as TRunDetailRow,
      stepRow("branch", "succeeded"),
      stepRow("email", "failed"),
      stepRow("http", "not_taken"),
    ]);
    expect(Object.fromEntries(badges)).toEqual({
      trigger: "succeeded",
      branch: "succeeded",
      email: "failed",
      http: "not_taken",
    });
  });

  test("a step the run has no row for didn't run (after a failure, or while it runs)", () => {
    const badges = getRunCanvasBadges(definition, [stepRow("branch", "failed")]);
    expect(badges.get("email")).toBe("not_reached");
    expect(badges.get("http")).toBe("not_reached");
  });
});

describe("pickRunGraph", () => {
  test("draws a run on the graph it ran when that is known", () => {
    expect(pickRunGraph({ runDefinition: definition, source: "test_run", draft })).toEqual({
      definition,
      isCurrentDraft: false,
    });
    expect(pickRunGraph({ runDefinition: definition, source: "version", draft })).toEqual({
      definition,
      isCurrentDraft: false,
    });
  });

  test("falls back to today's draft, flagged, for a Test run that saved no draft", () => {
    expect(pickRunGraph({ runDefinition: null, source: "unknown", draft })).toEqual({
      definition: draft,
      isCurrentDraft: true,
    });
  });

  test("has nothing to draw without either", () => {
    expect(pickRunGraph({ runDefinition: null, source: null, draft: null })).toEqual({
      definition: null,
      isCurrentDraft: false,
    });
  });
});

describe("getTestInputKind", () => {
  test("asks a Webhook workflow for a payload and a Response completed one for a response", () => {
    const webhook = { trigger: { triggerType: "webhook" }, nodes: [], edges: [] };
    const response = { trigger: { triggerType: "response.completed" }, nodes: [], edges: [] };
    expect(getTestInputKind(webhook as unknown as TWorkflowDefinition)).toBe("webhook");
    expect(getTestInputKind(response as unknown as TWorkflowDefinition)).toBe("response");
  });

  test("asks for nothing without a trigger, and is unknown while the draft loads", () => {
    expect(getTestInputKind({ trigger: null, nodes: [], edges: [] } as unknown as TWorkflowDefinition)).toBe(
      "none"
    );
    expect(getTestInputKind(null)).toBeNull();
  });
});
