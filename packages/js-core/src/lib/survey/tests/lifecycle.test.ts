import { beforeEach, describe, expect, test, vi } from "vitest";
import { Logger } from "@/lib/common/logger";
import { SurveyLifecycleEmitter } from "@/lib/survey/lifecycle";

describe("SurveyLifecycleEmitter", () => {
  let emitter: SurveyLifecycleEmitter;

  beforeEach(() => {
    vi.restoreAllMocks();
    SurveyLifecycleEmitter.getInstance().resetInstance();
    emitter = SurveyLifecycleEmitter.getInstance();
  });

  test("returns the same instance", () => {
    expect(SurveyLifecycleEmitter.getInstance()).toBe(emitter);
  });

  test("notifies every handler of the emitted type with the event", () => {
    const first = vi.fn();
    const second = vi.fn();
    const other = vi.fn();

    emitter.on("displayed", first);
    emitter.on("displayed", second);
    emitter.on("closed", other);

    emitter.emit({ type: "displayed", surveyId: "survey_1" });

    expect(first).toHaveBeenCalledWith({ type: "displayed", surveyId: "survey_1" });
    expect(second).toHaveBeenCalledWith({ type: "displayed", surveyId: "survey_1" });
    expect(other).not.toHaveBeenCalled();
  });

  test("registering the same handler twice notifies it once", () => {
    const handler = vi.fn();

    emitter.on("responded", handler);
    emitter.on("responded", handler);

    emitter.emit({ type: "responded", surveyId: "survey_1" });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  test("the function returned by on() removes the subscription", () => {
    const handler = vi.fn();
    const unsubscribe = emitter.on("displayed", handler);

    unsubscribe();
    emitter.emit({ type: "displayed", surveyId: "survey_1" });

    expect(handler).not.toHaveBeenCalled();
  });

  test("off() removes only the handler it names", () => {
    const removed = vi.fn();
    const kept = vi.fn();

    emitter.on("closed", removed);
    emitter.on("closed", kept);
    emitter.off("closed", removed);

    emitter.emit({ type: "closed", surveyId: "survey_1" });

    expect(removed).not.toHaveBeenCalled();
    expect(kept).toHaveBeenCalledTimes(1);
  });

  test("off() on an unknown handler or type is a no-op", () => {
    const handler = vi.fn();

    expect(() => {
      emitter.off("displayed", handler);
    }).not.toThrow();

    emitter.on("displayed", handler);
    emitter.off("displayed", vi.fn());
    emitter.emit({ type: "displayed", surveyId: "survey_1" });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  test("a handler that unsubscribes itself still receives the event it is handling", () => {
    const handler = vi.fn(() => {
      emitter.off("displayed", handler);
    });

    emitter.on("displayed", handler);

    expect(() => {
      emitter.emit({ type: "displayed", surveyId: "survey_1" });
    }).not.toThrow();
    expect(handler).toHaveBeenCalledTimes(1);

    emitter.emit({ type: "displayed", surveyId: "survey_2" });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test("a throwing handler is logged and does not stop the other handlers", () => {
    const errorSpy = vi.spyOn(Logger.getInstance(), "error").mockImplementation(() => undefined);
    const throwing = vi.fn(() => {
      throw new Error("host blew up");
    });
    const healthy = vi.fn();

    emitter.on("responded", throwing);
    emitter.on("responded", healthy);

    expect(() => {
      emitter.emit({ type: "responded", surveyId: "survey_1" });
    }).not.toThrow();

    expect(healthy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("host blew up"));
  });

  test("emitting with no subscribers does nothing", () => {
    expect(() => {
      emitter.emit({ type: "closed", surveyId: "survey_1" });
    }).not.toThrow();
  });
});
