import { makeReview, toolInput, updatedAt } from "./__mocks__/fixtures";
import { describe, expect, test } from "vitest";
import {
  buildPushArguments,
  capitalize,
  describeValue,
  getApprovalBlock,
  getConfirmLabel,
  getReviewedArguments,
  groupChanges,
  humanizeSegment,
  isLongValue,
  readApplyOutcome,
  readReview,
} from "./review";

const review = makeReview;

describe("readReview", () => {
  test("reads the review out of structuredContent.data", () => {
    expect(readReview({ structuredContent: { data: review(), requestId: "r" } })).toEqual(review());
  });

  test("is undefined for an error result, a missing body and a shape it does not know", () => {
    expect(readReview(null)).toBeUndefined();
    expect(readReview({ isError: true, structuredContent: { data: review() } })).toBeUndefined();
    expect(readReview({ content: [{ type: "text", text: "hi" }] })).toBeUndefined();
    expect(readReview({ structuredContent: { data: { ...review(), status: "maybe" } } })).toBeUndefined();
    expect(
      readReview({ structuredContent: { data: { ...review(), summary: { total: "2" } } } })
    ).toBeUndefined();
  });

  test("drops malformed entries instead of failing the whole review", () => {
    const parsed = readReview({
      structuredContent: {
        data: { ...review(), changes: [{ path: "a", kind: "changed" }, { path: 1 }, "x"] },
      },
    });
    expect(parsed?.changes).toEqual([{ path: "a", kind: "changed" }]);
  });

  test("needs the schema version of the stored document", () => {
    const { schemaVersion: _version, ...rest } = review();
    expect(readReview({ structuredContent: { data: rest } })).toBeUndefined();
    expect(readReview({ structuredContent: { data: { ...rest, schemaVersion: "1" } } })).toBeUndefined();
    expect(readReview({ structuredContent: { data: review({ schemaVersion: 2 }) } })?.schemaVersion).toBe(2);
  });

  test("defaults the omitted count", () => {
    const { omittedChanges: _omitted, ...rest } = review();
    expect(readReview({ structuredContent: { data: rest } })?.omittedChanges).toBe(0);
  });
});

describe("getReviewedArguments", () => {
  test("keeps only the five fields a review takes", () => {
    const result = getReviewedArguments({ ...toolInput, dryRun: true, confirmDestructive: true }, review());
    expect(result).toEqual({ ok: true, args: toolInput });
  });

  test("refuses when the input has not arrived or is incomplete", () => {
    expect(getReviewedArguments(null, review())).toMatchObject({ ok: false });
    expect(getReviewedArguments({ kind: "survey", id: "s1" }, review())).toMatchObject({ ok: false });
    expect(getReviewedArguments({ ...toolInput, document: [] }, review())).toMatchObject({ ok: false });
    expect(getReviewedArguments({ ...toolInput, kind: "form" }, review())).toMatchObject({ ok: false });
  });

  test("refuses arguments that are not the ones the review is about", () => {
    expect(getReviewedArguments({ ...toolInput, id: "other" }, review())).toMatchObject({ ok: false });
    expect(getReviewedArguments({ ...toolInput, kind: "workflow" }, review())).toMatchObject({ ok: false });
    expect(
      getReviewedArguments({ ...toolInput, expectedUpdatedAt: "2026-10-28T13:00:00.000Z" }, review())
    ).toMatchObject({ ok: false });
  });
});

describe("buildPushArguments", () => {
  const args = { ...toolInput };

  test("adds confirmDestructive only when the box was ticked, and never a dryRun", () => {
    expect(buildPushArguments(args, false)).toEqual(args);
    expect(buildPushArguments(args, true)).toEqual({ ...args, confirmDestructive: true });
    expect(buildPushArguments(args, true)).not.toHaveProperty("dryRun");
  });

  test("never carries a confirmation the person did not give", () => {
    expect(buildPushArguments({ ...args, confirmDestructive: true }, false)).not.toHaveProperty(
      "confirmDestructive"
    );
  });

  test("reuses the reviewed document as it is", () => {
    expect(buildPushArguments(args, true).document).toBe(args.document);
  });
});

describe("getApprovalBlock", () => {
  const ok = getReviewedArguments(toolInput, review());

  test("a valid review can be approved", () => {
    expect(getApprovalBlock(review(), ok, false)).toBeUndefined();
  });

  test("a stale or invalid review never can", () => {
    expect(getApprovalBlock(review({ status: "stale" }), ok, true)).toBe("stale");
    expect(getApprovalBlock(review({ status: "invalid" }), ok, true)).toBe("invalid");
  });

  test("a review with nothing to change has nothing to approve", () => {
    expect(
      getApprovalBlock(
        review({ summary: { total: 0, added: 0, removed: 0, changed: 0, destructive: 0 } }),
        ok,
        false
      )
    ).toBe("nothing");
  });

  test("a destructive review waits for the box", () => {
    const destructive = review({ status: "destructive" });
    expect(getApprovalBlock(destructive, ok, false)).toBe("confirm");
    expect(getApprovalBlock(destructive, ok, true)).toBeUndefined();
  });

  test("a push whose document version is not the one reviewed is blocked", () => {
    const other = getReviewedArguments({ ...toolInput, schemaVersion: 2 }, review());
    expect(getApprovalBlock(review(), other, false)).toBe("version");
    expect(getApprovalBlock(review({ schemaVersion: 2 }), ok, false)).toBe("version");
    expect(getApprovalBlock(review({ schemaVersion: 2 }), other, false)).toBeUndefined();
  });

  test("without trustworthy arguments nothing can be approved", () => {
    expect(getApprovalBlock(review(), getReviewedArguments(null, review()), false)).toBe("arguments");
  });
});

describe("getConfirmLabel", () => {
  test("completes 'I understand this removes' from what the server said would go", () => {
    expect(
      getConfirmLabel(
        review({
          status: "destructive",
          destructive: [
            { type: "blocks_removed", ids: ["b2"], removes: "1 question block", detail: "" },
            { type: "elements_removed", ids: ["e1", "e2"], removes: "2 questions", detail: "" },
          ],
        })
      )
    ).toBe("I understand this removes 1 question block and 2 questions.");
    expect(
      getConfirmLabel(
        review({
          destructive: [
            { type: "a", ids: [], removes: "x", detail: "" },
            { type: "b", ids: [], removes: "y", detail: "" },
            { type: "c", ids: [], removes: "z", detail: "" },
          ],
        })
      )
    ).toBe("I understand this removes x, y and z.");
  });

  test("falls back to a generic sentence", () => {
    expect(getConfirmLabel(review({ status: "destructive" }))).toBe("I understand this removes data.");
  });
});

describe("groupChanges", () => {
  test("groups by top-level field in order of appearance", () => {
    const groups = groupChanges([
      { path: "name", kind: "changed" },
      { path: "blocks[b1].elements[e1].headline.default", kind: "changed" },
      { path: "blocks[b2]", kind: "removed" },
      { path: "welcomeCard.enabled", kind: "changed" },
    ]);

    expect(groups.map((group) => [group.label, group.changes.length])).toEqual([
      ["Name", 1],
      ["Blocks", 2],
      ["Welcome card", 1],
    ]);
  });

  test("capitalizes the first letter only", () => {
    expect(capitalize("the destination")).toBe("The destination");
    expect(capitalize("")).toBe("");
  });

  test("humanizes camelCase", () => {
    expect(humanizeSegment("showLanguageSwitch")).toBe("Show language switch");
  });
});

describe("values", () => {
  test("strings are shown as they are, other values as JSON", () => {
    expect(describeValue("hello")).toBe("hello");
    expect(describeValue("")).toBe("(empty text)");
    expect(describeValue(null)).toBe("null");
    expect(describeValue(3)).toBe("3");
    expect(describeValue({ a: [1] })).toBe('{\n  "a": [\n    1\n  ]\n}');
    expect(describeValue(undefined)).toBe("");
  });

  test("long or tall values are collapsed", () => {
    expect(isLongValue("short")).toBe(false);
    expect(isLongValue("x".repeat(161))).toBe(true);
    expect(isLongValue("a\nb\nc\nd\ne")).toBe(true);
  });
});

describe("readApplyOutcome", () => {
  test("a real write that names the stored document is a success", () => {
    expect(
      readApplyOutcome({
        structuredContent: {
          data: { dryRun: false, envelope: { updatedAt: "2026-10-28T12:05:00.000Z" }, changes: [{}, {}] },
        },
      })
    ).toEqual({ ok: true, updatedAt: "2026-10-28T12:05:00.000Z", changeCount: 2 });
  });

  test("an ok result that did not write is not reported as applied", () => {
    expect(
      readApplyOutcome({
        structuredContent: { data: { dryRun: true, envelope: { updatedAt }, changes: [] } },
      })
    ).toMatchObject({ ok: false });
    expect(readApplyOutcome({ structuredContent: { data: {} } })).toMatchObject({ ok: false });
    expect(readApplyOutcome(null)).toMatchObject({ ok: false });
  });

  test("a stale refusal is recognised and keeps the server's words", () => {
    const outcome = readApplyOutcome({
      isError: true,
      structuredContent: {
        error: {
          status: 409,
          title: "Conflict",
          detail: "The resource changed since this document was pulled.",
          requestId: "req_1",
          details: { expectedUpdatedAt: updatedAt, currentUpdatedAt: "2026-10-28T13:00:00.000Z" },
        },
      },
    });
    expect(outcome).toEqual({
      ok: false,
      reason: "stale",
      title: "Conflict",
      detail: "The resource changed since this document was pulled.",
      issues: [],
      requestId: "req_1",
      status: 409,
    });
  });

  test("another 409 is not mistaken for a stale one, and problems are listed", () => {
    const outcome = readApplyOutcome({
      isError: true,
      structuredContent: {
        error: {
          status: 409,
          title: "Conflict",
          detail: "This push would remove data.",
          details: { reason: "destructive_change" },
          invalid_params: [{ name: "blocks", reason: "bad" }, { nope: true }],
        },
      },
    });
    expect(outcome).toMatchObject({
      ok: false,
      reason: "refused",
      issues: [{ name: "blocks", reason: "bad" }],
    });
  });

  test("falls back to the text of a bare error result", () => {
    expect(
      readApplyOutcome({ isError: true, content: [{ type: "text", text: "Tool unavailable" }] })
    ).toMatchObject({ ok: false, detail: "Tool unavailable" });
  });
});
