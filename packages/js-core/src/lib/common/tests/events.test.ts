import { type Mock, beforeEach, describe, expect, test } from "vitest";
import { FORMBRICKS_EVENTS, emitFormbricksEvent } from "@/lib/common/events";

const dispatchEventMock = window.dispatchEvent as unknown as Mock;

describe("emitFormbricksEvent", () => {
  beforeEach(() => {
    // The emitter creates `window.dataLayer` when absent; start every test from that state.
    delete (window as { dataLayer?: unknown }).dataLayer;
  });

  test("every event name carries the formbricks_ namespace — the string GTM triggers match", () => {
    for (const name of Object.values(FORMBRICKS_EVENTS)) {
      expect(name).toMatch(/^formbricks_/);
    }
  });

  test("dispatches a CustomEvent on window with the payload as detail", () => {
    emitFormbricksEvent(FORMBRICKS_EVENTS.surveyShown, { surveyId: "survey_1" });

    expect(dispatchEventMock).toHaveBeenCalledTimes(1);
    const event = dispatchEventMock.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe("formbricks_survey_shown");
    expect(event.detail).toEqual({ surveyId: "survey_1" });
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

  test("both transports fire for one emit, carrying the same payload", () => {
    emitFormbricksEvent(FORMBRICKS_EVENTS.setupSuccessful, { workspaceId: "ws_1" });

    const event = dispatchEventMock.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({ workspaceId: "ws_1" });
    expect(window.dataLayer?.[0]).toEqual({
      event: "formbricks_setup_successful",
      formbricks: {
        workspaceId: "ws_1",
        surveyId: null,
        responseId: null,
        finished: null,
        action: null,
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

  test("a throwing event listener cannot silence the dataLayer transport", () => {
    dispatchEventMock.mockImplementationOnce(() => {
      throw new Error("host listener exploded");
    });

    expect(() => {
      emitFormbricksEvent(FORMBRICKS_EVENTS.surveyShown, { surveyId: "survey_1" });
    }).not.toThrow();

    expect(window.dataLayer).toHaveLength(1);
  });

  test("a throwing dataLayer.push (GTM replaces it with host-owned code) never escapes into SDK flow", () => {
    const poisoned: Record<string, unknown>[] = [];
    poisoned.push = () => {
      throw new Error("host push exploded");
    };
    window.dataLayer = poisoned;

    expect(() => {
      emitFormbricksEvent(FORMBRICKS_EVENTS.surveyShown, { surveyId: "survey_1" });
    }).not.toThrow();

    // The CustomEvent transport still fired: the two are isolated separately.
    expect(dispatchEventMock).toHaveBeenCalledTimes(1);
  });
});
