import { mockPosthog } from "@/lib/posthog/__mocks__/posthog-js";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { WORKFLOW_CLIENT_EVENTS, WORKFLOW_LIFECYCLE_EVENTS, WORKFLOW_SURFACES } from "./analytics-events";

describe("trackWorkflowEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPosthog.__loaded = false;
  });

  test("drops a user-action event until PostHog is initialised", async () => {
    const { trackWorkflowEvent } = await import("./analytics");

    trackWorkflowEvent(WORKFLOW_CLIENT_EVENTS.listFiltered, { sort_by: "updatedAt" });

    expect(mockPosthog.capture).not.toHaveBeenCalled();
  });

  test("captures the event with its properties once loaded", async () => {
    mockPosthog.__loaded = true;
    const { trackWorkflowEvent } = await import("./analytics");

    trackWorkflowEvent(WORKFLOW_CLIENT_EVENTS.listFiltered, { sort_by: "updatedAt" });

    expect(mockPosthog.capture).toHaveBeenCalledWith("workflow_list_filtered", { sort_by: "updatedAt" });
  });
});

describe("trackWorkflowEventWhenReady", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockPosthog.__loaded = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("holds a mount event until PostHog finishes initialising, then captures it once", async () => {
    const { trackWorkflowEventWhenReady } = await import("./analytics");

    trackWorkflowEventWhenReady(WORKFLOW_CLIENT_EVENTS.surfaceViewed, { surface: "builder" });
    vi.advanceTimersByTime(200);
    expect(mockPosthog.capture).not.toHaveBeenCalled();

    mockPosthog.__loaded = true;
    vi.advanceTimersByTime(50);
    expect(mockPosthog.capture).toHaveBeenCalledTimes(1);
    expect(mockPosthog.capture).toHaveBeenCalledWith("workflow_surface_viewed", { surface: "builder" });

    vi.advanceTimersByTime(10_000);
    expect(mockPosthog.capture).toHaveBeenCalledTimes(1);
  });

  test("cancelling before PostHog is ready drops the event", async () => {
    const { trackWorkflowEventWhenReady } = await import("./analytics");

    const cancel = trackWorkflowEventWhenReady(WORKFLOW_CLIENT_EVENTS.surfaceViewed, { surface: "list" });
    cancel();
    mockPosthog.__loaded = true;
    vi.advanceTimersByTime(500);

    expect(mockPosthog.capture).not.toHaveBeenCalled();
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

describe("resolveWorkflowListSurface", () => {
  const settled = {
    showInitialLoading: false,
    isError: false,
    hasActiveFilters: false,
    workflowCount: 3,
  };

  test("loading is not a visit, and neither is an error that replaced the list", async () => {
    const { resolveWorkflowListSurface } = await import("./analytics");

    expect(resolveWorkflowListSurface({ ...settled, showInitialLoading: true, workflowCount: 0 })).toBeNull();
    expect(resolveWorkflowListSurface({ ...settled, isError: true, workflowCount: 0 })).toBeNull();
    // An error with rows still on screen is the list, the way the page still renders them.
    expect(resolveWorkflowListSurface({ ...settled, isError: true })).toBe("list");
  });

  test("an empty list is filtered or not, depending on the filters", async () => {
    const { resolveWorkflowListSurface } = await import("./analytics");

    expect(resolveWorkflowListSurface({ ...settled, workflowCount: 0 })).toBe("list_empty");
    expect(resolveWorkflowListSurface({ ...settled, workflowCount: 0, hasActiveFilters: true })).toBe(
      "list_empty_filtered"
    );
  });

  test("anything with rows is the list", async () => {
    const { resolveWorkflowListSurface } = await import("./analytics");

    expect(resolveWorkflowListSurface(settled)).toBe("list");
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
