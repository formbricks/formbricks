import { describe, expect, test } from "vitest";
import type { TV3DocumentEnvelope, TV3DocumentPushResult } from "@/app/api/v3/documents/lib/envelope";
import { type TDryRunOutcome, ZDocumentReview, buildDocumentReview, buildReviewText } from "./review";

const id = "kj4a98xxat96iws9zmbrgj3a";
const storedAt = "2026-10-28T12:00:00.000Z";

const current: TV3DocumentEnvelope = {
  kind: "survey",
  schemaVersion: 1,
  id,
  workspaceId: "ws1",
  updatedAt: storedAt,
  document: {
    name: "Onboarding",
    blocks: [
      { id: "b1", elements: [{ id: "e1", headline: { default: "Name?" } }] },
      { id: "b2", elements: [{ id: "e2", headline: { default: "Role?" } }] },
    ],
  },
};

const proposed = {
  name: "Onboarding v2",
  blocks: [{ id: "b1", elements: [{ id: "e1", headline: { default: "Name?" } }] }],
};

const pushResult = (document: Record<string, unknown>): TV3DocumentPushResult => ({
  envelope: { ...current, document },
  dryRun: true,
  changes: [],
});

const review = (outcome: TDryRunOutcome, overrides: { proposed?: Record<string, unknown> } = {}) =>
  buildDocumentReview({
    kind: "survey",
    id,
    expectedUpdatedAt: storedAt,
    proposed: overrides.proposed ?? proposed,
    current,
    outcome,
  });

describe("buildDocumentReview", () => {
  test("a valid push lists the changes against the stored document and counts them", () => {
    const result = review({ type: "ok", result: pushResult(proposed) });

    expect(ZDocumentReview.safeParse(result).success).toBe(true);
    expect(result).toMatchObject({
      kind: "survey",
      id,
      name: "Onboarding",
      workspaceId: "ws1",
      schemaVersion: 1,
      status: "valid",
      updatedAt: storedAt,
      expectedUpdatedAt: storedAt,
      summary: { total: 2, added: 0, removed: 1, changed: 1, destructive: 0 },
      omittedChanges: 0,
      destructive: [],
      issues: [],
    });
    expect(result.changes.map((change) => `${change.kind} ${change.path}`)).toEqual([
      "removed blocks[b2]",
      "changed name",
    ]);
  });

  test("diffs against the document the push would store, not the one that was sent", () => {
    const normalised = { ...proposed, name: "Onboarding v2 (normalised)" };
    const result = review({ type: "ok", result: pushResult(normalised) });

    expect(result.changes.find((change) => change.path === "name")?.after).toBe("Onboarding v2 (normalised)");
  });

  test("carries the schema version of the stored document, which the view checks before it pushes", () => {
    const result = review({ type: "ok", result: pushResult(proposed) });
    expect(result.schemaVersion).toBe(current.schemaVersion);

    const { schemaVersion: _omitted, ...withoutVersion } = result;
    expect(ZDocumentReview.safeParse(withoutVersion).success).toBe(false);
  });

  test("an unchanged document is valid with no changes", () => {
    const result = review({ type: "ok", result: pushResult(current.document) });
    expect(result.status).toBe("valid");
    expect(result.summary.total).toBe(0);
    expect(result.changes).toEqual([]);
  });

  test("a destructive push flags the removal and carries the refusal's wording", () => {
    const result = review({
      type: "destructive",
      changes: [{ type: "blocks_removed", ids: ["b2"], responseCount: 14 }],
      result: pushResult(proposed),
    });

    expect(result.status).toBe("destructive");
    expect(result.destructive).toEqual([
      expect.objectContaining({
        type: "blocks_removed",
        ids: ["b2"],
        responseCount: 14,
        removes: "1 question block",
      }),
    ]);
    expect(result.changes.find((change) => change.path === "blocks[b2]")).toMatchObject({
      destructive: true,
    });
    expect(result.summary.destructive).toBe(1);
  });

  test("a destructive push whose second dry run failed still shows the diff against what was sent", () => {
    const result = review({ type: "destructive", changes: [{ type: "elements_removed", ids: ["e2"] }] });

    expect(result.status).toBe("destructive");
    expect(result.summary.total).toBe(2);
    // e2 left with its block, so no entry carries it; the refusal's own count is still reported.
    expect(result.summary.destructive).toBe(1);
  });

  test("a stale push says why and diffs the proposal against what is stored now", () => {
    const result = review({ type: "stale", detail: "The resource changed since this document was pulled." });

    expect(result.status).toBe("stale");
    expect(result.detail).toContain("changed since");
    expect(result.summary.total).toBe(2);
  });

  test("an invalid push lists the problems and no changes", () => {
    const result = review({
      type: "invalid",
      detail: "Survey document failed validation",
      issues: [{ name: "blocks.0.elements.0.type", reason: "Unknown type" }],
    });

    expect(result).toMatchObject({
      status: "invalid",
      detail: "Survey document failed validation",
      issues: [{ name: "blocks.0.elements.0.type", reason: "Unknown type" }],
      changes: [],
      summary: { total: 0 },
    });
  });

  test("names the document after the stored name, then the pushed one, then the id", () => {
    const withoutName = { ...current, document: {} };
    const base = {
      kind: "survey" as const,
      id,
      expectedUpdatedAt: storedAt,
      outcome: { type: "ok" as const, result: pushResult({}) },
    };

    expect(buildDocumentReview({ ...base, current: withoutName, proposed: { name: "Pushed" } }).name).toBe(
      "Pushed"
    );
    expect(buildDocumentReview({ ...base, current: withoutName, proposed: {} }).name).toBe(`survey ${id}`);
  });

  test("caps a long list and reports how many were left out", () => {
    const keys = Object.fromEntries(Array.from({ length: 130 }, (_, index) => [`field${index}`, index]));
    const after = Object.fromEntries(Object.keys(keys).map((key) => [key, -1]));
    const result = buildDocumentReview({
      kind: "survey",
      id,
      expectedUpdatedAt: storedAt,
      proposed: after,
      current: { ...current, document: keys },
      outcome: { type: "ok", result: pushResult(after) },
    });

    expect(result.summary.total).toBe(130);
    expect(result.changes).toHaveLength(100);
    expect(result.omittedChanges).toBe(30);
  });
});

describe("buildReviewText", () => {
  test("a valid review counts the changes, names the paths and tells the model to wait", () => {
    const text = buildReviewText(review({ type: "ok", result: pushResult(proposed) }));

    expect(text).toContain(`survey ${id}`);
    expect(text).toContain("2 changes (0 added, 1 removed, 1 changed), 0 destructive");
    expect(text).toContain("removed blocks[b2]; changed name");
    expect(text).toContain("Nothing was written");
    expect(text).toContain("do not call push_document until they approve");
  });

  test("a destructive review says what goes and that the user must confirm it", () => {
    const text = buildReviewText(
      review({
        type: "destructive",
        changes: [{ type: "blocks_removed", ids: ["b2"], responseCount: 14 }],
        result: pushResult(proposed),
      })
    );

    expect(text).toContain("1 destructive");
    expect(text).toContain("removes data: 1 question block");
    expect(text).toContain("tick the confirmation");
  });

  test("a stale review tells the model to pull again", () => {
    const text = buildReviewText(review({ type: "stale", detail: "x" }));
    expect(text).toContain("Call pull_document again");
    expect(text).toContain("cannot be approved");
    expect(text).not.toContain("do not call push_document until they approve");
  });

  test("an invalid review lists up to five problems", () => {
    const issues = Array.from({ length: 7 }, (_, index) => ({ name: `f${index}`, reason: "bad" }));
    const text = buildReviewText(review({ type: "invalid", detail: "Failed", issues }));

    expect(text).toContain("f0: bad");
    expect(text).toContain("f4: bad");
    expect(text).not.toContain("f5: bad");
    expect(text).toContain("(and 2 more)");
  });

  test("an unchanged document has nothing to approve", () => {
    expect(buildReviewText(review({ type: "ok", result: pushResult(current.document) }))).toContain(
      "nothing to approve"
    );
  });

  test("lists at most twelve paths and counts the rest", () => {
    const before = Object.fromEntries(
      Array.from({ length: 20 }, (_, index) => [`f${String(index).padStart(2, "0")}`, 0])
    );
    const after = Object.fromEntries(Object.keys(before).map((key) => [key, 1]));
    const text = buildReviewText(
      buildDocumentReview({
        kind: "survey",
        id,
        expectedUpdatedAt: storedAt,
        proposed: after,
        current: { ...current, document: before },
        outcome: { type: "ok", result: pushResult(after) },
      })
    );

    expect(text).toContain("changed f11;");
    expect(text).not.toContain("changed f12");
    expect(text).toContain("and 8 more");
  });
});
