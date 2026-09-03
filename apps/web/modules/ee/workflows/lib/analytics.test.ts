import { beforeEach, describe, expect, test, vi } from "vitest";
import { WORKFLOW_CLIENT_EVENTS, WORKFLOW_LIFECYCLE_EVENTS, WORKFLOW_SURFACES } from "./analytics-events";

const mocks = vi.hoisted(() => ({
  posthog: { __loaded: false, capture: vi.fn() },
}));

vi.mock("posthog-js", () => ({ default: mocks.posthog }));

describe("trackWorkflowEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.posthog.__loaded = false;
  });

  test("is a no-op until PostHog is initialised", async () => {
    const { trackWorkflowEvent } = await import("./analytics");

    trackWorkflowEvent(WORKFLOW_CLIENT_EVENTS.surfaceViewed, { surface: "list" });

    expect(mocks.posthog.capture).not.toHaveBeenCalled();
  });

  test("captures the event with its properties once loaded", async () => {
    mocks.posthog.__loaded = true;
    const { trackWorkflowEvent } = await import("./analytics");

    trackWorkflowEvent(WORKFLOW_CLIENT_EVENTS.canvasAction, { action: "auto-layout" });

    expect(mocks.posthog.capture).toHaveBeenCalledWith("workflow_canvas_action", { action: "auto-layout" });
  });
});

describe("summarizeValidationProblems", () => {
  test("counts every problem but reports each code once, sorted, and never the field paths", async () => {
    const { summarizeValidationProblems } = await import("./analytics");

    const summary = summarizeValidationProblems([
      { code: "step_incomplete", field: "nodes.send-email.config.to" },
      { code: "trigger_survey_unbound", field: "trigger.config.surveyId" },
      { code: "step_incomplete", field: "nodes.send-email.config.subject" },
    ]);

    expect(summary).toEqual({
      problem_count: 3,
      problem_codes: ["step_incomplete", "trigger_survey_unbound"],
    });
    expect(JSON.stringify(summary)).not.toContain("send-email");
  });
});

describe("event contract", () => {
  test("every event name is snake_case with the workflow_ prefix, and none collides across the two maps", () => {
    const names = [...Object.values(WORKFLOW_LIFECYCLE_EVENTS), ...Object.values(WORKFLOW_CLIENT_EVENTS)];

    for (const name of names) expect(name).toMatch(/^workflow_[a-z_]+$/);
    expect(new Set(names).size).toBe(names.length);
  });

  test("surfaces are a closed, snake_case set", () => {
    for (const surface of WORKFLOW_SURFACES) expect(surface).toMatch(/^[a-z_]+$/);
    expect(new Set(WORKFLOW_SURFACES).size).toBe(WORKFLOW_SURFACES.length);
  });
});
