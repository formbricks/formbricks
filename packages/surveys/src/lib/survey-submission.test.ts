import { describe, expect, test } from "vitest";
import { createSurveySubmissionGuard } from "./survey-submission";

describe("survey submission ownership", () => {
  test("rejects an outgoing card even when it receives the next render's handler", () => {
    const guard = createSurveySubmissionGuard("a");
    const firstVisit = guard.current;
    const release = guard.begin(firstVisit, "a");
    expect(release).toBeTypeOf("function");
    const secondVisit = guard.navigate("b");
    release?.();

    expect(guard.begin(firstVisit, "a")).toBeUndefined();
    expect(guard.begin(secondVisit, "a")).toBeUndefined();
    expect(guard.begin(secondVisit, "b")).toBeTypeOf("function");
  });

  test("blocks repeated input during preparation and permits a retry after failure", () => {
    const guard = createSurveySubmissionGuard("a");
    const release = guard.begin(guard.current, "a");
    expect(release).toBeTypeOf("function");
    expect(guard.begin(guard.current, "a")).toBeUndefined();
    release?.();
    expect(guard.begin(guard.current, "a")).toBeTypeOf("function");
  });

  test("Back permits resubmission without accepting an earlier visit's delayed work", () => {
    const guard = createSurveySubmissionGuard("a");
    const firstVisit = guard.current;
    const releaseOld = guard.begin(firstVisit, "a");
    guard.navigate("b");
    const revisited = guard.navigate("a");

    expect(guard.isCurrent(firstVisit, "a")).toBe(false);
    expect(guard.begin(firstVisit, "a")).toBeUndefined();
    expect(guard.begin(revisited, "a")).toBeTypeOf("function");
    releaseOld?.();
    expect(guard.begin(revisited, "a")).toBeUndefined();
  });

  test("a same-block logic jump starts a new visit", () => {
    const guard = createSurveySubmissionGuard("a");
    const previous = guard.current;
    guard.begin(previous, "a");
    const next = guard.navigate("a");
    expect(guard.begin(previous, "a")).toBeUndefined();
    expect(guard.begin(next, "a")).toBeTypeOf("function");
  });

  test("welcome-card input cannot submit the first question", () => {
    const guard = createSurveySubmissionGuard("start");
    expect(guard.begin(guard.current, "start")).toBeTypeOf("function");
    guard.navigate("a");
    expect(guard.begin(guard.current, "start")).toBeUndefined();
    expect(guard.begin(guard.current, "a")).toBeTypeOf("function");
  });
});
