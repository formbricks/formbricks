import { describe, expect, test } from "vitest";
import { isSameAttachmentExportFilter } from "./same-filter";

describe("isSameAttachmentExportFilter", () => {
  test("matches no filter against no filter", () => {
    expect(isSameAttachmentExportFilter(null, undefined)).toBe(true);
  });

  test("matches the same filter whatever its key order, with dates as stored", () => {
    const createdAt = {
      min: new Date("2026-10-01T00:00:00.000Z"),
      max: new Date("2026-10-31T00:00:00.000Z"),
    };
    const stored = JSON.parse(JSON.stringify({ createdAt, finished: true }));

    expect(isSameAttachmentExportFilter(stored, { finished: true, createdAt })).toBe(true);
  });

  test("tells a filtered export from an unfiltered one", () => {
    expect(isSameAttachmentExportFilter({ finished: true }, undefined)).toBe(false);
    expect(isSameAttachmentExportFilter(null, { finished: true })).toBe(false);
  });

  test("tells two different filters apart", () => {
    expect(isSameAttachmentExportFilter({ finished: true }, { finished: false })).toBe(false);
  });
});
