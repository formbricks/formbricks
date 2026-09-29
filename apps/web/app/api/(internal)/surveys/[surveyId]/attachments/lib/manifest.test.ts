import { describe, expect, test, vi } from "vitest";
import type { TAttachmentEntry } from "@/modules/storage/lib/collect-response-attachments";
import { MANIFEST_FIELDS, buildAttachmentManifestCsv } from "./manifest";

vi.mock("server-only", () => ({}));

const entry = (overrides: Partial<TAttachmentEntry> = {}): TAttachmentEntry => ({
  zipPath: "2026-09-01_res-1/2_Upload a photo/photo.jpg",
  responseId: "res-1",
  responseCreatedAt: new Date("2026-09-01T10:00:00.000Z"),
  elementId: "el-upload",
  elementLabel: "Upload a photo",
  originalFileName: "photo.jpg",
  status: "ok",
  bytes: 2048,
  ...overrides,
});

describe("buildAttachmentManifestCsv", () => {
  test("writes the documented columns in order", async () => {
    const csv = await buildAttachmentManifestCsv([]);
    expect(csv.split("\n")[0]).toBe(MANIFEST_FIELDS.map((field) => `"${field}"`).join(","));
  });

  test("renders a row that joins the file back to its response", async () => {
    const csv = await buildAttachmentManifestCsv([entry()]);
    const row = csv.split("\n")[1];

    expect(row).toContain('"2026-09-01_res-1/2_Upload a photo/photo.jpg"');
    expect(row).toContain('"res-1"');
    expect(row).toContain('"el-upload"');
    expect(row).toContain('"photo.jpg"');
    expect(row).toContain('"ok"');
    expect(row).toContain("2048");
  });

  test("writes timestamps as ISO 8601 UTC, not a localised string", async () => {
    // The manifest is machine-facing: it has to join against the CSV export whoever downloads it.
    const csv = await buildAttachmentManifestCsv([entry()]);
    expect(csv).toContain('"2026-09-01T10:00:00.000Z"');
  });

  test("leaves the size blank for a row that produced no file", async () => {
    const csv = await buildAttachmentManifestCsv([
      entry({ status: "skipped_foreign_workspace", zipPath: "", bytes: undefined }),
    ]);
    const row = csv.split("\n")[1];

    expect(row).toContain('"skipped_foreign_workspace"');
    expect(row.endsWith('"","skipped_foreign_workspace"')).toBe(true);
  });

  test("defangs a headline that a spreadsheet would evaluate as a formula", async () => {
    // Element labels and file names are respondent-supplied, so they reach the CSV boundary untrusted.
    const csv = await buildAttachmentManifestCsv([entry({ elementLabel: "=SUM(A1:A2)" })]);
    expect(csv).toContain("'=SUM(A1:A2)");
  });
});
