import { describe, expect, test, vi } from "vitest";
import { ValidationError } from "@formbricks/types/errors";
import { normalizeSurveyScheduling } from "./survey-scheduling";

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  queueAuditEventWithoutRequest: vi.fn(),
}));

vi.mock("./constants", () => ({
  SURVEY_SCHEDULING_CONFIG: { timeZone: "UTC", localHour: 9, localMinute: 0 },
  SURVEY_SCHEDULING_RECONCILIATION_BATCH_SIZE: 250,
}));

// The editor stores a picked day as noon UTC (`toDateOnlySelection`).
const day = (isoDate: string) => new Date(`${isoDate}T12:00:00.000Z`);

describe("normalizeSurveyScheduling", () => {
  test("Schedule from a draft keeps both picked days", () => {
    const result = normalizeSurveyScheduling({
      currentStatus: "draft",
      status: "paused",
      publishOn: day("2026-10-25"),
      closeOn: day("2026-10-27"),
    });

    expect(result).toEqual({
      publishOn: new Date("2026-10-25T09:00:00.000Z"),
      closeOn: new Date("2026-10-27T09:00:00.000Z"),
    });
  });

  test("Activate from a draft clears the activation date and keeps the close date", () => {
    const result = normalizeSurveyScheduling({
      currentStatus: "draft",
      status: "inProgress",
      publishOn: day("2026-10-25"),
      closeOn: day("2026-10-27"),
    });

    expect(result).toEqual({ publishOn: null, closeOn: new Date("2026-10-27T09:00:00.000Z") });
  });

  test("refuses a close date on or before the activation date with a message that says so", () => {
    expect(() =>
      normalizeSurveyScheduling({
        currentStatus: "draft",
        status: "paused",
        publishOn: day("2026-10-27"),
        closeOn: day("2026-10-25"),
      })
    ).toThrow(new ValidationError("Close date must be after publish date"));
  });
});
