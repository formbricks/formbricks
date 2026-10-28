import { describe, expect, test } from "vitest";
import { formatDateTime, formatDuration } from "./format";
import type { RunDetail, RunStepLog } from "./model";
import {
  buildStepOutcomes,
  describeRunDuration,
  describeRunFailure,
  describeRunStart,
  describeRunTrigger,
  describeTriggerPayload,
  getElapsedMs,
  getRunStatusStyle,
  getStepStatusStyle,
  summarizeRecord,
  summarizeRuns,
} from "./runs";

describe("status styles", () => {
  test("pair every status with a word, so meaning never rests on colour alone", () => {
    expect(getRunStatusStyle("failed")).toEqual({ label: "Failed", tone: "danger" });
    expect(getRunStatusStyle("completed")).toEqual({ label: "Completed", tone: "success" });
    expect(getRunStatusStyle("running").tone).toBe("info");
    expect(getStepStatusStyle("skipped")).toEqual({ label: "Skipped", tone: "neutral" });
    expect(getStepStatusStyle("succeeded").tone).toBe("success");
  });
});

describe("durations", () => {
  test("measure a finished run and refuse a nonsensical one", () => {
    expect(getElapsedMs("2026-06-09T12:00:00.000Z", "2026-06-09T12:00:03.200Z")).toBe(3200);
    expect(getElapsedMs("2026-06-09T12:00:03.000Z", "2026-06-09T12:00:00.000Z")).toBeNull();
    expect(getElapsedMs(null, "2026-06-09T12:00:00.000Z")).toBeNull();
    expect(getElapsedMs("nope", "2026-06-09T12:00:00.000Z")).toBeNull();
  });

  test("read in the unit a person would say", () => {
    expect(formatDuration(840)).toBe("840 ms");
    expect(formatDuration(4200)).toBe("4.2 s");
    expect(formatDuration(30_000)).toBe("30 s");
    expect(formatDuration(61_000)).toBe("1 min 1 s");
    expect(formatDuration(180_000)).toBe("3 min");
    expect(formatDuration(7_800_000)).toBe("2 h 10 min");
  });

  test("say what an unfinished run is doing instead of a duration", () => {
    const base = { startedAt: null, finishedAt: null };
    expect(describeRunDuration({ ...base, status: "queued" })).toBe("Waiting to start");
    expect(describeRunDuration({ ...base, status: "running" })).toBe("In progress");
    expect(describeRunDuration({ ...base, status: "canceled" })).toBe("No duration");
    expect(
      describeRunDuration({
        status: "completed",
        startedAt: "2026-06-09T12:00:00Z",
        finishedAt: "2026-06-09T12:00:01Z",
      })
    ).toBe("1 s");
  });
});

describe("describeRunTrigger", () => {
  test("tells a test from a real response", () => {
    expect(describeRunTrigger({ isDryRun: true, responseId: null })).toBe("Test run with sample data");
    expect(describeRunTrigger({ isDryRun: false, responseId: "k3j9x0v2m8q1w7e5r4t6y2u1" })).toBe(
      "Survey response k3j9x0v2…"
    );
    expect(describeRunTrigger({ isDryRun: false, responseId: null })).toBe("Survey response");
  });
});

describe("describeRunFailure", () => {
  test("shows nothing for a run that did not fail", () => {
    expect(describeRunFailure({ status: "completed", error: null, attempt: 0 })).toBeNull();
  });

  test("shows the message, the attempt it died on, and a fallback when none was recorded", () => {
    expect(describeRunFailure({ status: "failed", error: "SMTP rejected", attempt: 2 })).toBe(
      "SMTP rejected (attempt 3)"
    );
    expect(describeRunFailure({ status: "failed", error: null, attempt: 0 })).toBe(
      "No failure message was recorded."
    );
    // A retrying run keeps its last error while it is running again.
    expect(describeRunFailure({ status: "running", error: "timeout", attempt: 1 })).toBe(
      "timeout (attempt 2)"
    );
  });
});

describe("dates", () => {
  test("format in the host's locale and time zone", () => {
    expect(formatDateTime("2026-06-09T22:30:00.000Z", "en-US", "Asia/Tokyo")).toBe("Jun 10, 2026, 7:30 AM");
    expect(formatDateTime("2026-06-09T22:30:00.000Z", "de-DE", "UTC")).toBe("09.06.2026, 22:30");
  });

  test("fall back instead of throwing on a locale or zone the runtime rejects", () => {
    expect(() => formatDateTime("2026-06-09T22:30:00.000Z", "not a locale", "Mars/Olympus")).not.toThrow();
    expect(formatDateTime("garbage")).toBe("garbage");
  });

  test("date a run that has not started by when it was created", () => {
    expect(describeRunStart({ startedAt: null, createdAt: "2026-06-09T12:00:00.000Z" }, "en-US", "UTC")).toBe(
      "Created Jun 9, 2026, 12:00 PM"
    );
    expect(
      describeRunStart(
        { startedAt: "2026-06-09T12:01:00.000Z", createdAt: "2026-06-09T12:00:00.000Z" },
        "en-US",
        "UTC"
      )
    ).toBe("Jun 9, 2026, 12:01 PM");
  });
});

describe("summarizeRecord", () => {
  test("labels keys, shows an email body as text, and bounds how much it shows", () => {
    const { details, hidden } = summarizeRecord({
      messageId: "<a@b>",
      body: "<p>Hello <b>there</b></p>",
      attempts: 2,
      sent: false,
      nothing: null,
      nested: { deep: { deeper: true } },
      seventh: "x",
    });
    expect(details.map((d) => [d.label, d.value])).toEqual([
      ["Message id", "<a@b>"],
      ["Body", "Hello there"],
      ["Attempts", "2"],
      ["Sent", "false"],
      ["Nothing", "null"],
      ["Nested", '{"deep":{"deeper":true}}'],
    ]);
    expect(hidden).toBe(1);
  });
});

describe("buildStepOutcomes", () => {
  const log = (partial: Partial<RunStepLog>): RunStepLog => ({
    id: "l",
    sequence: 0,
    stepId: "send-email",
    stepType: "send_email",
    status: "succeeded",
    error: null,
    startedAt: "2026-06-09T12:00:00.000Z",
    finishedAt: "2026-06-09T12:00:01.500Z",
    input: {},
    output: {},
    ...partial,
  });

  test("name steps after the workflow's own, time them and carry their failure", () => {
    const outcomes = buildStepOutcomes(
      [
        log({ id: "1" }),
        log({
          id: "2",
          stepId: "gone",
          stepType: "post_slack",
          status: "failed",
          error: "boom",
          finishedAt: null,
        }),
      ],
      new Map([["send-email", "Send thank you email"]])
    );
    expect(outcomes.map((o) => [o.name, o.status, o.duration, o.error])).toEqual([
      ["Send thank you email", "succeeded", "1.5 s", null],
      ["Post slack", "failed", null, "boom"],
    ]);
  });
});

describe("describeTriggerPayload", () => {
  test("shows ids and a count, never the answers", () => {
    const run = {
      responseId: "resp1",
      endingCardId: "end1",
      responseFieldCount: 3,
    } as RunDetail;
    expect(describeTriggerPayload(run)).toEqual([
      { label: "Response", value: "resp1" },
      { label: "Ending card", value: "end1" },
      { label: "Answers carried", value: "3" },
    ]);
    expect(
      describeTriggerPayload({ ...run, responseId: null, endingCardId: null, responseFieldCount: 0 })
    ).toEqual([{ label: "Answers carried", value: "None" }]);
  });
});

describe("summarizeRuns", () => {
  test("counts what is shown and what failed", () => {
    expect(summarizeRuns([])).toBe("No runs yet");
    expect(summarizeRuns([{ status: "completed" }, { status: "completed" }])).toBe("2 shown");
    expect(summarizeRuns([{ status: "failed" }, { status: "completed" }, { status: "failed" }])).toBe(
      "2 failed of 3 shown"
    );
  });
});
