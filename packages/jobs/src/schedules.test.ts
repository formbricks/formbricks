import { describe, expect, test } from "vitest";
import { getDelayForRunAtSchedule, getRecurringJobSchedulerId } from "./schedules";

describe("@formbricks/jobs schedules", () => {
  test("clamps small past drift to immediate execution", () => {
    const now = new Date("2026-04-07T10:00:00.000Z");

    expect(
      getDelayForRunAtSchedule(
        {
          runAt: new Date("2026-04-07T09:59:58.000Z"),
        },
        now
      )
    ).toBe(0);
  });

  test("rejects runAt values that are too far in the past", () => {
    const now = new Date("2026-04-07T10:00:00.000Z");

    expect(() =>
      getDelayForRunAtSchedule(
        {
          runAt: new Date("2026-04-07T09:59:54.000Z"),
        },
        now
      )
    ).toThrow("Background job runAt is too far in the past");
  });

  test("builds recurring scheduler keys with explicit scope", () => {
    expect(
      getRecurringJobSchedulerId("response-pipeline.process", {
        scheduleId: "daily-sync",
        scope: "environment_123",
      })
    ).toBe("response-pipeline.process:environment_123:daily-sync");
  });
});
