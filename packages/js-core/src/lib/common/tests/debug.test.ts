import { beforeEach, describe, expect, test, vi } from "vitest";

// Read lazily, so each test can switch debug mode on or off for the fresh modules it imports.
const flags = vi.hoisted(() => ({ isDebug: false }));

vi.mock("@/lib/common/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/common/utils")>()),
  getIsDebug: () => flags.isDebug,
}));

describe("debug events", () => {
  let appendChild: ReturnType<typeof vi.fn>;
  let getElementById: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // The buffer, the debug session and the subscriber registry are module state: start every test
    // from fresh modules.
    vi.resetModules();
    flags.isDebug = false;
    delete (window as { dataLayer?: unknown }).dataLayer;
    appendChild = vi.fn();
    getElementById = vi.fn(() => null);
    vi.stubGlobal("document", {
      ...document,
      getElementById,
      createElement: vi.fn(() => ({})),
      head: { appendChild },
    });
  });

  const load = async () => ({
    ...(await import("@/lib/common/debug")),
    ...(await import("@/lib/common/events")),
  });
  const surveyEvent = { surveyId: "s1", stage: "trigger" as const, outcome: "shown" as const };

  test("costs nothing and records nothing outside debug mode", async () => {
    const { emitDebugSurveyEvent, onDebugEvent } = await load();
    emitDebugSurveyEvent(surveyEvent);

    const handler = vi.fn();
    onDebugEvent(handler);
    emitDebugSurveyEvent(surveyEvent);

    expect(handler).not.toHaveBeenCalled();
  });

  test("in debug mode, reaches formbricks.on subscribers but never the dataLayer", async () => {
    flags.isDebug = true;
    const { emitDebugSurveyEvent, onDebugEvent } = await load();
    const handler = vi.fn();
    onDebugEvent(handler);

    emitDebugSurveyEvent(surveyEvent);

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ type: "survey", ...surveyEvent }));
    // The payload carries the visitor's URLs; the dataLayer feeds the host's analytics tags.
    expect(window.dataLayer).toBeUndefined();
  });

  test("a late subscriber, like the panel script, first gets what already happened, in order", async () => {
    flags.isDebug = true;
    const { emitDebugSurveyEvent, onDebugEvent } = await load();
    emitDebugSurveyEvent(surveyEvent);
    emitDebugSurveyEvent({ ...surveyEvent, surveyId: "s2" });

    const received: string[] = [];
    onDebugEvent((event) => received.push(event.type === "survey" ? event.surveyId : "visit"));
    emitDebugSurveyEvent({ ...surveyEvent, surveyId: "s3" });

    expect(received).toEqual(["s1", "s2", "s3"]);
  });

  test("keeps only the last 200 events for late subscribers", async () => {
    flags.isDebug = true;
    const { emitDebugSurveyEvent, onDebugEvent } = await load();
    for (let i = 1; i <= 205; i++) emitDebugSurveyEvent({ ...surveyEvent, surveyId: `s${i.toString()}` });

    const received: string[] = [];
    onDebugEvent((event) => received.push(event.type === "survey" ? event.surveyId : "visit"));

    expect(received).toHaveLength(200);
    expect(received[0]).toBe("s6");
  });

  test("a throwing handler during the replay does not stop it or escape", async () => {
    flags.isDebug = true;
    const { emitDebugSurveyEvent, onDebugEvent } = await load();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    emitDebugSurveyEvent(surveyEvent);
    emitDebugSurveyEvent({ ...surveyEvent, surveyId: "s2" });

    const handler = vi.fn(() => {
      throw new Error("host bug");
    });

    expect(() => onDebugEvent(handler)).not.toThrow();
    expect(handler).toHaveBeenCalledTimes(2);
    consoleError.mockRestore();
  });

  test("unsubscribing stops further events", async () => {
    flags.isDebug = true;
    const { emitDebugSurveyEvent, onDebugEvent } = await load();
    const handler = vi.fn();
    const unsubscribe = onDebugEvent(handler);
    unsubscribe();

    emitDebugSurveyEvent(surveyEvent);

    expect(handler).not.toHaveBeenCalled();
  });

  test("stays on after an SPA route change leaves a URL without the flag", async () => {
    const { emitDebugSurveyEvent, onDebugEvent, startDebugSession } = await load();
    startDebugSession("https://app.formbricks.com");
    const handler = vi.fn();
    onDebugEvent(handler);

    emitDebugSurveyEvent(surveyEvent);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  test("loads the panel script once, from the instance", async () => {
    const { startDebugSession } = await load();
    startDebugSession("https://app.formbricks.com");
    getElementById.mockReturnValue({});
    startDebugSession("https://app.formbricks.com");

    expect(appendChild).toHaveBeenCalledTimes(1);
    expect(appendChild.mock.calls[0][0]).toMatchObject({
      src: "https://app.formbricks.com/js/formbricks-debug.js",
      async: true,
    });
  });
});
