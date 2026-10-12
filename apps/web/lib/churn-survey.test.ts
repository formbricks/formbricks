import { createStorage } from "./__mocks__/session-storage";
import { describe, expect, test, vi } from "vitest";
import {
  CHURN_SURVEY_PENDING_KEY,
  SUBSCRIPTION_CANCELLED_EVENT,
  consumeChurnSurveyMarker,
  getHobbyDowngradeChurnSignal,
  markChurnSurveyPending,
  trackSubscriptionCancelled,
} from "./churn-survey";

describe("getHobbyDowngradeChurnSignal", () => {
  test("a scheduled downgrade to Hobby tracks right away", () => {
    expect(getHobbyDowngradeChurnSignal("hobby", "scheduled")).toBe("track-now");
    expect(getHobbyDowngradeChurnSignal("hobby", undefined)).toBe("track-now");
  });

  test("an immediate (trial) downgrade to Hobby defers the event across the reload", () => {
    expect(getHobbyDowngradeChurnSignal("hobby", "immediate")).toBe("defer-until-reload");
  });

  test("a change to any other plan is not a churn signal", () => {
    expect(getHobbyDowngradeChurnSignal("pro", "immediate")).toBe("none");
    expect(getHobbyDowngradeChurnSignal("scale", "scheduled")).toBe("none");
  });
});

describe("trackSubscriptionCancelled", () => {
  test("sends subscription_cancelled", () => {
    const track = vi.fn().mockResolvedValue(undefined);
    trackSubscriptionCancelled(track);
    expect(track).toHaveBeenCalledExactlyOnceWith(SUBSCRIPTION_CANCELLED_EVENT);
  });

  test("swallows a rejected delivery instead of leaving an unhandled rejection", async () => {
    const track = vi.fn().mockRejectedValue(new Error("offline"));
    await expect(trackSubscriptionCancelled(track)).resolves.toBeUndefined();
  });
});

describe("markChurnSurveyPending", () => {
  test("stores the acting user's id under the marker key", () => {
    const storage = createStorage();
    markChurnSurveyPending(storage, "user-1");
    expect(storage.getItem(CHURN_SURVEY_PENDING_KEY)).toBe("user-1");
  });

  test("is a no-op without storage", () => {
    expect(() => markChurnSurveyPending(undefined, "user-1")).not.toThrow();
  });
});

describe("consumeChurnSurveyMarker", () => {
  test("sends the event once for the marked user and clears the marker", async () => {
    const storage = createStorage({ [CHURN_SURVEY_PENDING_KEY]: "user-1" });
    const track = vi.fn().mockResolvedValue(undefined);
    const inFlight = { current: false };

    await consumeChurnSurveyMarker({ storage, userId: "user-1", track, inFlight });
    await consumeChurnSurveyMarker({ storage, userId: "user-1", track, inFlight });

    expect(track).toHaveBeenCalledExactlyOnceWith(SUBSCRIPTION_CANCELLED_EVENT);
    expect(storage.getItem(CHURN_SURVEY_PENDING_KEY)).toBeNull();
    expect(inFlight.current).toBe(false);
  });

  test("does nothing when there is no marker", async () => {
    const track = vi.fn();
    await consumeChurnSurveyMarker({
      storage: createStorage(),
      userId: "user-1",
      track,
      inFlight: { current: false },
    });
    expect(track).not.toHaveBeenCalled();
  });

  test("leaves another user's marker alone after a logout/login in the same tab", async () => {
    const storage = createStorage({ [CHURN_SURVEY_PENDING_KEY]: "user-1" });
    const track = vi.fn();

    await consumeChurnSurveyMarker({ storage, userId: "user-2", track, inFlight: { current: false } });

    expect(track).not.toHaveBeenCalled();
    expect(storage.getItem(CHURN_SURVEY_PENDING_KEY)).toBe("user-1");
  });

  test("a second run while the first is in flight does not send the event again", async () => {
    const storage = createStorage({ [CHURN_SURVEY_PENDING_KEY]: "user-1" });
    let release: () => void = () => undefined;
    const track = vi.fn(() => new Promise<void>((resolve) => (release = resolve)));
    const inFlight = { current: false };

    const first = consumeChurnSurveyMarker({ storage, userId: "user-1", track, inFlight });
    await consumeChurnSurveyMarker({ storage, userId: "user-1", track, inFlight });
    release();
    await first;

    expect(track).toHaveBeenCalledTimes(1);
    expect(storage.getItem(CHURN_SURVEY_PENDING_KEY)).toBeNull();
  });

  test("keeps the marker, and frees the guard, when tracking rejects", async () => {
    const storage = createStorage({ [CHURN_SURVEY_PENDING_KEY]: "user-1" });
    const track = vi.fn().mockRejectedValue(new Error("offline"));
    const inFlight = { current: false };

    await expect(consumeChurnSurveyMarker({ storage, userId: "user-1", track, inFlight })).rejects.toThrow(
      "offline"
    );

    expect(storage.getItem(CHURN_SURVEY_PENDING_KEY)).toBe("user-1");
    expect(inFlight.current).toBe(false);
  });

  test("does not delete a newer cancellation that overwrote the marker mid-flight", async () => {
    const storage = createStorage({ [CHURN_SURVEY_PENDING_KEY]: "user-1" });
    const track = vi.fn(async () => {
      storage.setItem(CHURN_SURVEY_PENDING_KEY, "user-2");
    });

    await consumeChurnSurveyMarker({ storage, userId: "user-1", track, inFlight: { current: false } });

    expect(storage.getItem(CHURN_SURVEY_PENDING_KEY)).toBe("user-2");
  });

  test("is a no-op without storage", async () => {
    const track = vi.fn();
    await consumeChurnSurveyMarker({
      storage: undefined,
      userId: "user-1",
      track,
      inFlight: { current: false },
    });
    expect(track).not.toHaveBeenCalled();
  });
});
