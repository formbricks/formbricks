import { describe, expect, test } from "vitest";
import {
  ZBackgroundJobScheduleIdentity,
  ZRecurringBackgroundJobSchedule,
  getDelayForRunAtSchedule,
  getRecurringJobSchedulerId,
} from "./schedules";

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

  test("rejects reserved delimiters in recurring scheduler identities", () => {
    expect(() =>
      ZBackgroundJobScheduleIdentity.parse({
        scheduleId: "daily:sync",
        scope: "environment_123",
      })
    ).toThrow(/reserved in recurring scheduler ids/);

    expect(() =>
      getRecurringJobSchedulerId("response-pipeline.process", {
        scheduleId: "daily-sync",
        scope: "environment:123",
      })
    ).toThrow(/reserved in recurring scheduler ids/);

    expect(() =>
      getRecurringJobSchedulerId("response:pipeline.process", {
        scheduleId: "daily-sync",
        scope: "environment_123",
      })
    ).toThrow(/reserved in recurring scheduler ids/);
  });

  test("discriminates recurring schedules by kind", () => {
    const parsedEverySchedule = ZRecurringBackgroundJobSchedule.parse({
      everyMs: 1_000,
      kind: "every",
    });
    const parsedCronSchedule = ZRecurringBackgroundJobSchedule.parse({
      cronPattern: "*/5 * * * *",
      kind: "cron",
    });

    expect(parsedEverySchedule.kind).toBe("every");
    expect(parsedCronSchedule.kind).toBe("cron");
  });

  test("reports schedule window validation failures on endAt", () => {
    const result = ZRecurringBackgroundJobSchedule.safeParse({
      kind: "cron",
      cronPattern: "*/5 * * * *",
      startAt: new Date("2026-04-07T10:00:00.000Z"),
      endAt: new Date("2026-04-07T09:00:00.000Z"),
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: "endAt must be after startAt",
          path: ["endAt"],
        }),
      ])
    );
  });
});
