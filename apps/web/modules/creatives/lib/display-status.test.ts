import { describe, expect, test } from "vitest";
import { type TCreativeStatusInput, getCreativeDisplayState } from "./display-status";

const now = new Date("2026-10-15T12:00:00Z");
const hoursFromNow = (hours: number) => new Date(now.getTime() + hours * 3_600_000);

const live: TCreativeStatusInput = {
  status: "inProgress",
  archivedAt: null,
  startsAt: null,
  endsAt: null,
  linkedSurveyStatus: "inProgress",
};

describe("getCreativeDisplayState", () => {
  test("an in-progress creative with a running survey and no schedule is active", () => {
    expect(getCreativeDisplayState(live, now)).toEqual({ status: "active", reason: null });
    expect(getCreativeDisplayState({ ...live, linkedSurveyStatus: null }, now).status).toBe("active");
  });

  test("archived wins over everything, then draft and completed are the author's word", () => {
    expect(getCreativeDisplayState({ ...live, status: "draft", archivedAt: now }, now).status).toBe(
      "archived"
    );
    expect(getCreativeDisplayState({ ...live, status: "draft", startsAt: hoursFromNow(5) }, now).status).toBe(
      "draft"
    );
    expect(getCreativeDisplayState({ ...live, status: "completed" }, now)).toEqual({
      status: "closed",
      reason: null,
    });
  });

  test("the schedule narrows an in-progress creative to scheduled or closed", () => {
    expect(getCreativeDisplayState({ ...live, startsAt: hoursFromNow(1) }, now).status).toBe("scheduled");
    expect(getCreativeDisplayState({ ...live, endsAt: hoursFromNow(-1) }, now)).toEqual({
      status: "closed",
      reason: "schedule_ended",
    });
    expect(getCreativeDisplayState({ ...live, endsAt: now }, now).status).toBe("closed");
  });

  test("a survey that isn't running pauses the creative and says why", () => {
    expect(getCreativeDisplayState({ ...live, linkedSurveyStatus: "paused" }, now)).toEqual({
      status: "paused",
      reason: "survey_not_active",
    });
    expect(getCreativeDisplayState({ ...live, linkedSurveyStatus: "completed" }, now).status).toBe("paused");
  });

  test("an own pause carries no reason, and an ended schedule outranks it", () => {
    expect(getCreativeDisplayState({ ...live, status: "paused" }, now)).toEqual({
      status: "paused",
      reason: null,
    });
    expect(getCreativeDisplayState({ ...live, status: "paused", endsAt: hoursFromNow(-1) }, now).status).toBe(
      "closed"
    );
  });
});
