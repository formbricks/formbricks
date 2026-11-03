import { describe, expect, test } from "vitest";
import type { TAttachmentExport, TAttachmentExportStatus } from "../types";
import {
  ATTACHMENT_EXPORT_POLL_INTERVAL_MS,
  findNewlySettledExports,
  formatArchiveSize,
  getAttachmentExportsRefetchInterval,
} from "./query";

const exportWith = (id: string, status: TAttachmentExportStatus): TAttachmentExport => ({
  id,
  surveyId: "survey-1",
  status,
  filtered: false,
  fileCount: 3,
  responseCount: 2,
  includedFileCount: null,
  totalBytes: null,
  truncated: false,
  errorCode: null,
  createdAt: "2026-11-03T12:00:00.000Z",
  finishedAt: null,
  expiresAt: null,
});

describe("getAttachmentExportsRefetchInterval", () => {
  test.each(["queued", "running"] as const)("polls while an export is %s", (status) => {
    expect(getAttachmentExportsRefetchInterval([exportWith("a", "completed"), exportWith("b", status)])).toBe(
      ATTACHMENT_EXPORT_POLL_INTERVAL_MS
    );
  });

  test("stops once every export has settled, and before the first answer", () => {
    expect(
      getAttachmentExportsRefetchInterval([exportWith("a", "completed"), exportWith("b", "failed")])
    ).toBe(false);
    expect(getAttachmentExportsRefetchInterval(undefined)).toBe(false);
  });
});

describe("findNewlySettledExports", () => {
  test("returns exports that were building and have now settled", () => {
    const previous = [exportWith("a", "running"), exportWith("b", "queued"), exportWith("c", "running")];
    const next = [exportWith("a", "completed"), exportWith("b", "failed"), exportWith("c", "running")];

    expect(findNewlySettledExports(previous, next).map((item) => item.id)).toEqual(["a", "b"]);
  });

  test("announces nothing on the first answer, so a page load does not replay old exports", () => {
    expect(findNewlySettledExports(undefined, [exportWith("a", "completed")])).toEqual([]);
  });

  test("does not announce an export that was already settled", () => {
    expect(findNewlySettledExports([exportWith("a", "completed")], [exportWith("a", "completed")])).toEqual(
      []
    );
  });
});

describe("formatArchiveSize", () => {
  test("shows megabytes below a gigabyte and gigabytes above", () => {
    expect(formatArchiveSize(812 * 1024 * 1024, "en-US")).toBe("812 MB");
    expect(formatArchiveSize(3.4 * 1024 * 1024 * 1024, "en-US")).toBe("3.4 GB");
    expect(formatArchiveSize(1.5 * 1024 * 1024, "en-US")).toBe("1.5 MB");
  });
});
