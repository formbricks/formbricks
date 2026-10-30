import { describe, expect, test } from "vitest";
import { SIGNATURE_SUMMARY_LIMIT, summarizeSignatureAnswers } from "./signature-summary";

const url = (n: number) => `/storage/ws/private/surveys/s1/elements/sig/signature--fid--${n}.png`;

const response = (id: string, data: Record<string, unknown>, ttc: Record<string, number> = {}) => ({
  id,
  data: data as never,
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  contact: null,
  contactAttributes: {},
  ttc,
});

describe("summarizeSignatureAnswers", () => {
  test("counts signed answers and lists them in the order given, with their response ids", () => {
    const summary = summarizeSignatureAnswers("sig", [
      response("r2", { sig: url(2) }),
      response("r1", { sig: url(1) }),
    ]);

    expect(summary.signedCount).toBe(2);
    expect(summary.skippedCount).toBe(0);
    expect(summary.responseCount).toBe(2);
    expect(summary.signatures.map((s) => [s.id, s.value])).toEqual([
      ["r2", url(2)],
      ["r1", url(1)],
    ]);
  });

  test("counts an empty answer as skipped and keeps it out of the thumbnails", () => {
    const summary = summarizeSignatureAnswers("sig", [
      response("r1", { sig: "" }),
      response("r2", { sig: url(2) }),
    ]);

    expect(summary).toMatchObject({ signedCount: 1, skippedCount: 1, responseCount: 2 });
    expect(summary.signatures.map((s) => s.id)).toEqual(["r2"]);
  });

  test("counts a missing answer as skipped only when the respondent reached the element", () => {
    const summary = summarizeSignatureAnswers("sig", [
      response("seen", { other: "x" }, { sig: 1200 }),
      response("never-reached", { other: "x" }),
    ]);

    expect(summary).toMatchObject({ signedCount: 0, skippedCount: 1, responseCount: 1 });
  });

  test("ignores answers that are not strings, and other elements' answers", () => {
    const summary = summarizeSignatureAnswers("sig", [
      response("r1", { sig: [url(1)] }),
      response("r2", { other: url(2) }),
    ]);

    expect(summary).toMatchObject({ signedCount: 0, skippedCount: 0, responseCount: 0, signatures: [] });
  });

  test("keeps counting past the thumbnail limit but lists only the latest ones", () => {
    const responses = Array.from({ length: SIGNATURE_SUMMARY_LIMIT + 5 }, (_, i) =>
      response(`r${i}`, { sig: url(i) })
    );

    const summary = summarizeSignatureAnswers("sig", responses);

    expect(SIGNATURE_SUMMARY_LIMIT).toBe(10);
    expect(summary.signedCount).toBe(15);
    expect(summary.signatures).toHaveLength(10);
    expect(summary.signatures[0].id).toBe("r0");
    expect(summary.signatures[9].id).toBe("r9");
  });
});
