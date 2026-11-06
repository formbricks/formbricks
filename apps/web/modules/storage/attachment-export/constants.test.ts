import { describe, expect, test } from "vitest";
import { getAttachmentExportExpiry } from "./constants";

describe("getAttachmentExportExpiry", () => {
  test.each([
    ["2026-11-03T12:00:00.000Z", "2027-02-03T12:00:00.000Z"],
    // A day the target month lacks is clamped to its last day, never rolled into the next month.
    ["2027-01-31T08:30:00.000Z", "2027-04-30T08:30:00.000Z"],
    ["2026-11-30T23:59:59.000Z", "2027-02-28T23:59:59.000Z"],
    ["2027-11-30T00:00:00.000Z", "2028-02-29T00:00:00.000Z"],
  ])("an archive built at %s expires at %s", (finishedAt, expected) => {
    expect(getAttachmentExportExpiry(new Date(finishedAt)).toISOString()).toBe(expected);
  });
});
