import { describe, expect, test, vi } from "vitest";
import { ValidationError } from "@formbricks/types/errors";
import { normalizeSurveyScheduling } from "./survey-scheduling";

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  queueAuditEventWithoutRequest: vi.fn(),
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

    expect(result.publishOn).toBeInstanceOf(Date);
    expect(result.closeOn).toBeInstanceOf(Date);
    expect(result.closeOn!.getTime()).toBeGreaterThan(result.publishOn!.getTime());
  });

  test("Activate from a draft clears the activation date", () => {
    const result = normalizeSurveyScheduling({
      currentStatus: "draft",
      status: "inProgress",
      publishOn: null,
      closeOn: null,
    });

    expect(result).toEqual({ publishOn: null, closeOn: null });
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
