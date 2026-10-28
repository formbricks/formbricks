import { describe, expect, test } from "vitest";
import {
  MAX_VALUE_CHARACTERS,
  type TDocumentChange,
  describeDestructiveChange,
  diffDocumentValues,
  isSameValue,
  limitChanges,
  limitValue,
  markDestructiveChanges,
} from "./diff";

const block = (id: string, headline: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: id,
  elements: [{ id: `${id}_q`, type: "openText", headline: { default: headline } }],
  ...extra,
});

describe("isSameValue", () => {
  test("ignores key order but not array order", () => {
    expect(isSameValue({ a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 })).toBe(true);
    expect(isSameValue([1, 2], [2, 1])).toBe(false);
  });

  test("treats a key set to undefined as absent", () => {
    expect(isSameValue({ a: 1, b: undefined }, { a: 1 })).toBe(true);
  });

  test("tells null from an object and from absent", () => {
    expect(isSameValue({ a: null }, { a: {} })).toBe(false);
    expect(isSameValue({ a: null }, {})).toBe(false);
  });
});

describe("diffDocumentValues", () => {
  test("reports nothing for equal documents", () => {
    expect(
      diffDocumentValues(
        { name: "A", blocks: [block("b1", "Hi")] },
        { blocks: [block("b1", "Hi")], name: "A" }
      )
    ).toEqual([]);
  });

  test("goes down to the field and lists keys in sorted order", () => {
    const before = { name: "A", welcomeCard: { enabled: true, headline: { default: "Hi" } } };
    const after = { welcomeCard: { headline: { default: "Hello" }, enabled: true }, name: "B" };

    expect(diffDocumentValues(before, after)).toEqual([
      { path: "name", kind: "changed", before: "A", after: "B" },
      { path: "welcomeCard.headline.default", kind: "changed", before: "Hi", after: "Hello" },
    ]);
  });

  test("reports added and removed keys", () => {
    expect(diffDocumentValues({ a: 1, b: 2 }, { b: 2, c: 3 })).toEqual([
      { path: "a", kind: "removed", before: 1 },
      { path: "c", kind: "added", after: 3 },
    ]);
  });

  test("matches blocks by id: an insert is one addition, not a shift of every later block", () => {
    const before = { blocks: [block("b1", "One"), block("b2", "Two")] };
    const after = { blocks: [block("b1", "One"), block("bx", "New"), block("b2", "Two")] };

    expect(diffDocumentValues(before, after)).toEqual([
      { path: "blocks[bx]", kind: "added", after: block("bx", "New") },
      // The new block sits between the two that stayed, which is an order change of the kept ones: none.
    ]);
  });

  test("goes into a matched block and its elements", () => {
    const before = { blocks: [block("b1", "One")] };
    const after = { blocks: [block("b1", "Uno")] };

    expect(diffDocumentValues(before, after)).toEqual([
      { path: "blocks[b1].elements[b1_q].headline.default", kind: "changed", before: "One", after: "Uno" },
    ]);
  });

  test("reports a removed block with its whole content", () => {
    expect(
      diffDocumentValues(
        { blocks: [block("b1", "One"), block("b2", "Two")] },
        { blocks: [block("b1", "One")] }
      )
    ).toEqual([{ path: "blocks[b2]", kind: "removed", before: block("b2", "Two") }]);
  });

  test("reports a reorder of kept members as a change of the list itself", () => {
    const before = { blocks: [block("b1", "One"), block("b2", "Two")] };
    const after = { blocks: [block("b2", "Two"), block("b1", "One")] };

    expect(diffDocumentValues(before, after)).toEqual([
      { path: "blocks", kind: "changed", before: ["b1", "b2"], after: ["b2", "b1"] },
    ]);
  });

  test("treats lists without ids, or with repeated ids, as one value", () => {
    expect(diffDocumentValues({ tags: ["a", "b"] }, { tags: ["a", "c"] })).toEqual([
      { path: "tags", kind: "changed", before: ["a", "b"], after: ["a", "c"] },
    ]);
    const twins = [
      { id: "x", v: 1 },
      { id: "x", v: 2 },
    ];
    expect(diffDocumentValues({ list: twins }, { list: [{ id: "x", v: 1 }] })).toEqual([
      { path: "list", kind: "changed", before: twins, after: [{ id: "x", v: 1 }] },
    ]);
  });

  test("an object that becomes another kind of object is replaced as a whole", () => {
    expect(
      diffDocumentValues(
        { destination: { type: "survey", surveyId: "s1" } },
        { destination: { type: "url", url: "https://a.example" } }
      )
    ).toEqual([
      {
        path: "destination",
        kind: "changed",
        before: { type: "survey", surveyId: "s1" },
        after: { type: "url", url: "https://a.example" },
      },
    ]);
  });

  test("an object whose type stays is still compared field by field", () => {
    expect(
      diffDocumentValues(
        { node: { type: "slack", channel: "#a" } },
        { node: { type: "slack", channel: "#b" } }
      )
    ).toEqual([{ path: "node.channel", kind: "changed", before: "#a", after: "#b" }]);
  });

  test("a value that becomes null, or an object, is one change at its own path", () => {
    expect(
      diffDocumentValues({ destination: { type: "url", url: "https://a.example" } }, { destination: null })
    ).toEqual([
      {
        path: "destination",
        kind: "changed",
        before: { type: "url", url: "https://a.example" },
        after: null,
      },
    ]);
  });
});

describe("limitValue", () => {
  test("leaves short values alone, whatever their type", () => {
    expect(limitValue("short")).toBe("short");
    expect(limitValue({ a: 1 })).toEqual({ a: 1 });
    expect(limitValue(null)).toBeNull();
    expect(limitValue(undefined)).toBeUndefined();
  });

  test("cuts a long string and says how long it was", () => {
    const long = "x".repeat(MAX_VALUE_CHARACTERS + 50);
    expect(limitValue(long)).toBe(
      `${"x".repeat(MAX_VALUE_CHARACTERS)}…[truncated, ${long.length} characters]`
    );
  });

  test("turns a large object into a marked text preview", () => {
    const large = { items: Array.from({ length: 200 }, (_, index) => ({ index })) };
    const limited = limitValue(large) as string;
    expect(typeof limited).toBe("string");
    expect(limited.startsWith('{"items":[{"index":0}')).toBe(true);
    expect(limited).toContain(`…[truncated, ${JSON.stringify(large).length} characters]`);
  });
});

describe("describeDestructiveChange", () => {
  test("names removed blocks and questions with the response count", () => {
    expect(
      describeDestructiveChange({ type: "blocks_removed", ids: ["b1", "b2"], responseCount: 14 })
    ).toMatchObject({
      type: "blocks_removed",
      ids: ["b1", "b2"],
      responseCount: 14,
      removes: "2 question blocks",
      detail: expect.stringContaining("The survey has 14 responses."),
    });
    expect(
      describeDestructiveChange({ type: "elements_removed", ids: ["e1"], responseCount: 1 })
    ).toMatchObject({
      removes: "1 question",
      detail: expect.stringContaining("Their answers stay stored"),
    });
  });

  test("names the creative cases and falls back to the type for one it does not know", () => {
    expect(describeDestructiveChange({ type: "destination_removed", ids: ["s1"] }).removes).toBe(
      "the destination this live creative opens"
    );
    expect(describeDestructiveChange({ type: "survey_left_unopened" }).ids).toEqual([]);
    expect(describeDestructiveChange({ type: "something_new" }).removes).toBe("something new");
  });
});

describe("markDestructiveChanges", () => {
  const removedBlock: TDocumentChange = { path: "blocks[b2]", kind: "removed", before: {} };
  const removedElement: TDocumentChange = { path: "blocks[b1].elements[e9]", kind: "removed", before: {} };
  const renamed: TDocumentChange = { path: "name", kind: "changed", before: "A", after: "B" };

  test("flags the removed entries whose id the refusal named, and only those", () => {
    const marked = markDestructiveChanges(
      [renamed, removedBlock, removedElement],
      [
        describeDestructiveChange({ type: "blocks_removed", ids: ["b2"], responseCount: 3 }),
        describeDestructiveChange({
          type: "elements_removed",
          ids: ["e9", "inside_removed_block"],
          responseCount: 3,
        }),
      ]
    );

    expect(marked[0]).toEqual(renamed);
    expect(marked[1]).toMatchObject({
      path: "blocks[b2]",
      destructive: true,
      reason: expect.stringContaining("question block"),
    });
    expect(marked[2]).toMatchObject({ destructive: true, reason: expect.stringContaining("question") });
  });

  test("does not flag an addition that merely shares an id", () => {
    const added: TDocumentChange = { path: "blocks[b2]", kind: "added", after: {} };
    expect(
      markDestructiveChanges([added], [describeDestructiveChange({ type: "blocks_removed", ids: ["b2"] })])
    ).toEqual([added]);
  });

  test("flags every entry under the destination for the destination cases", () => {
    const entries: TDocumentChange[] = [
      { path: "destination", kind: "changed", before: {}, after: null },
      { path: "destination.surveyId", kind: "changed", before: "a", after: "b" },
      { path: "destinationLabel", kind: "changed", before: "a", after: "b" },
      renamed,
    ];
    const marked = markDestructiveChanges(entries, [
      describeDestructiveChange({ type: "destination_changed", ids: ["s1"] }),
    ]);

    expect(marked.map((entry) => Boolean(entry.destructive))).toEqual([true, true, false, false]);
  });

  test("returns the entries untouched when nothing is destructive", () => {
    const entries = [renamed];
    expect(markDestructiveChanges(entries, [])).toBe(entries);
  });
});

describe("limitChanges", () => {
  const many = (count: number): TDocumentChange[] =>
    Array.from({ length: count }, (_, index) => ({
      path: `k${index}`,
      kind: "changed",
      before: index,
      after: index + 1,
    }));

  test("lists everything up to the cap and counts nothing as omitted", () => {
    expect(limitChanges(many(3), 5)).toEqual({ changes: many(3), omitted: 0 });
  });

  test("caps the list and counts the rest", () => {
    const { changes, omitted } = limitChanges(many(10), 4);
    expect(changes.map((change) => change.path)).toEqual(["k0", "k1", "k2", "k3"]);
    expect(omitted).toBe(6);
  });

  test("keeps destructive entries even past the cap, in document order", () => {
    const entries = many(10);
    entries[8] = { ...entries[8], destructive: true };
    const { changes, omitted } = limitChanges(entries, 3);

    expect(changes.map((change) => change.path)).toEqual(["k0", "k1", "k8"]);
    expect(omitted).toBe(7);
  });

  test("cuts the values it keeps", () => {
    const long = "y".repeat(MAX_VALUE_CHARACTERS + 1);
    const { changes } = limitChanges([{ path: "a", kind: "changed", before: long, after: "short" }]);
    expect(changes[0].before).toContain("…[truncated, 401 characters]");
    expect(changes[0].after).toBe("short");
  });
});
