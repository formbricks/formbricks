import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  FORMBRICKS_EVENTS,
  emitFormbricksEvent,
  offFormbricksEvent,
  onFormbricksEvent,
  resetFormbricksEventSubscribers,
} from "@/lib/common/events";

describe("emitFormbricksEvent", () => {
  beforeEach(() => {
    // The emitter creates `window.dataLayer` when absent; start every test from that state, and
    // from a subscriber-free registry.
    delete (window as { dataLayer?: unknown }).dataLayer;
    resetFormbricksEventSubscribers();
  });

  test("every event name carries the formbricks_ namespace — the string GTM triggers and on() match", () => {
    for (const name of Object.values(FORMBRICKS_EVENTS)) {
      expect(name).toMatch(/^formbricks_/);
    }
  });

  test("creates window.dataLayer when absent and pushes the nested envelope", () => {
    expect(window.dataLayer).toBeUndefined();

    emitFormbricksEvent(FORMBRICKS_EVENTS.responseSubmitted, {
      surveyId: "survey_1",
      responseId: "response_1",
      finished: true,
    });

    // Nested under `formbricks`, never spread flat: GTM merges pushes, so a flat `finished` or
    // `action` would collide with the host's own dataLayer keys. And the FULL key set every time,
    // nulls included: GTM merges recursively, so an omitted key would leave a previous event's
    // value readable under this event's trigger.
    expect(window.dataLayer).toEqual([
      {
        event: "formbricks_response_submitted",
        formbricks: {
          workspaceId: null,
          action: null,
          surveyId: "survey_1",
          responseId: "response_1",
          finished: true,
        },
      },
    ]);
  });

  test("appends to a pre-existing dataLayer, never replaces it — the host's queued events survive", () => {
    const hostEntry = { event: "host_event", cart: "abc" };
    window.dataLayer = [hostEntry];

    emitFormbricksEvent(FORMBRICKS_EVENTS.actionTracked, { action: "clicked_demo" });

    expect(window.dataLayer[0]).toBe(hostEntry);
    expect(window.dataLayer).toHaveLength(2);
    expect(window.dataLayer[1]).toEqual({
      event: "formbricks_action_tracked",
      formbricks: {
        workspaceId: null,
        surveyId: null,
        responseId: null,
        finished: null,
        action: "clicked_demo",
      },
    });
  });

  test("a payload key present with value undefined falls back to the null sentinel, not undefined", () => {
    // `responseId` is typed optional by the widened callbacks, so an emit can carry it as an
    // explicit undefined. If that survived the merge it would replace the null sentinel — and GTM's
    // recursive merge would keep an EARLIER event's responseId readable under this event's trigger.
    emitFormbricksEvent(FORMBRICKS_EVENTS.responseSubmitted, {
      surveyId: "survey_1",
      responseId: undefined,
      finished: true,
    });

    expect(window.dataLayer?.[0]).toEqual({
      event: "formbricks_response_submitted",
      formbricks: {
        workspaceId: null,
        action: null,
        surveyId: "survey_1",
        responseId: null,
        finished: true,
      },
    });
  });

  test("a non-array dataLayer (a host shim) is replaced instead of throwing on .push", () => {
    (window as { dataLayer?: unknown }).dataLayer = {};

    expect(() => {
      emitFormbricksEvent(FORMBRICKS_EVENTS.surveyShown, { surveyId: "survey_1" });
    }).not.toThrow();

    expect(Array.isArray(window.dataLayer)).toBe(true);
    expect(window.dataLayer).toHaveLength(1);
  });

  test("a throwing dataLayer.push (GTM replaces it with host-owned code) never escapes, and subscribers still fire", () => {
    const poisoned: Record<string, unknown>[] = [];
    poisoned.push = () => {
      throw new Error("host push exploded");
    };
    window.dataLayer = poisoned;

    const handler = vi.fn();
    onFormbricksEvent(FORMBRICKS_EVENTS.surveyShown, handler);

    expect(() => {
      emitFormbricksEvent(FORMBRICKS_EVENTS.surveyShown, { surveyId: "survey_1" });
    }).not.toThrow();

    // The subscription surface still fired: the two are isolated separately.
    expect(handler).toHaveBeenCalledWith({ surveyId: "survey_1" });
  });
});

describe("on() / off() subscriptions", () => {
  beforeEach(() => {
    delete (window as { dataLayer?: unknown }).dataLayer;
    resetFormbricksEventSubscribers();
    vi.restoreAllMocks();
  });

  test("notifies every handler of the emitted event with its payload, and no other event's handlers", () => {
    const first = vi.fn();
    const second = vi.fn();
    const other = vi.fn();

    onFormbricksEvent(FORMBRICKS_EVENTS.surveyShown, first);
    onFormbricksEvent(FORMBRICKS_EVENTS.surveyShown, second);
    onFormbricksEvent(FORMBRICKS_EVENTS.surveyClosed, other);

    emitFormbricksEvent(FORMBRICKS_EVENTS.surveyShown, { surveyId: "survey_1" });

    expect(first).toHaveBeenCalledWith({ surveyId: "survey_1" });
    expect(second).toHaveBeenCalledWith({ surveyId: "survey_1" });
    expect(other).not.toHaveBeenCalled();
  });

  test("registering the same handler twice notifies it once", () => {
    const handler = vi.fn();

    onFormbricksEvent(FORMBRICKS_EVENTS.responseSubmitted, handler);
    onFormbricksEvent(FORMBRICKS_EVENTS.responseSubmitted, handler);

    emitFormbricksEvent(FORMBRICKS_EVENTS.responseSubmitted, { surveyId: "survey_1", finished: false });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  test("the function returned by on() removes the subscription; off() removes only the handler it names", () => {
    const viaReturn = vi.fn();
    const viaOff = vi.fn();
    const kept = vi.fn();

    const unsubscribe = onFormbricksEvent(FORMBRICKS_EVENTS.surveyShown, viaReturn);
    onFormbricksEvent(FORMBRICKS_EVENTS.surveyShown, viaOff);
    onFormbricksEvent(FORMBRICKS_EVENTS.surveyShown, kept);

    unsubscribe();
    offFormbricksEvent(FORMBRICKS_EVENTS.surveyShown, viaOff);
    emitFormbricksEvent(FORMBRICKS_EVENTS.surveyShown, { surveyId: "survey_1" });

    expect(viaReturn).not.toHaveBeenCalled();
    expect(viaOff).not.toHaveBeenCalled();
    expect(kept).toHaveBeenCalledTimes(1);
  });

  test("off() on an unknown handler or event is a no-op", () => {
    const handler = vi.fn();

    expect(() => {
      offFormbricksEvent(FORMBRICKS_EVENTS.surveyShown, handler);
    }).not.toThrow();

    onFormbricksEvent(FORMBRICKS_EVENTS.surveyShown, handler);
    offFormbricksEvent(FORMBRICKS_EVENTS.surveyShown, vi.fn());
    emitFormbricksEvent(FORMBRICKS_EVENTS.surveyShown, { surveyId: "survey_1" });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  test("a handler that unsubscribes itself still receives the event it is handling", () => {
    const handler = vi.fn(() => {
      offFormbricksEvent(FORMBRICKS_EVENTS.surveyShown, handler);
    });

    onFormbricksEvent(FORMBRICKS_EVENTS.surveyShown, handler);

    expect(() => {
      emitFormbricksEvent(FORMBRICKS_EVENTS.surveyShown, { surveyId: "survey_1" });
    }).not.toThrow();
    expect(handler).toHaveBeenCalledTimes(1);

    emitFormbricksEvent(FORMBRICKS_EVENTS.surveyShown, { surveyId: "survey_2" });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test("a throwing handler is logged and stops neither the other handlers nor the dataLayer push", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const throwing = vi.fn(() => {
      throw new Error("host blew up");
    });
    const healthy = vi.fn();

    onFormbricksEvent(FORMBRICKS_EVENTS.surveyClosed, throwing);
    onFormbricksEvent(FORMBRICKS_EVENTS.surveyClosed, healthy);

    expect(() => {
      emitFormbricksEvent(FORMBRICKS_EVENTS.surveyClosed, { surveyId: "survey_1" });
    }).not.toThrow();

    expect(healthy).toHaveBeenCalledTimes(1);
    expect(window.dataLayer).toHaveLength(1);
    expect(errorSpy).toHaveBeenCalled();
  });

  test("emitting with no subscribers still pushes to the dataLayer", () => {
    expect(() => {
      emitFormbricksEvent(FORMBRICKS_EVENTS.setupSuccessful, { workspaceId: "ws_1" });
    }).not.toThrow();
    expect(window.dataLayer).toHaveLength(1);
  });
});
