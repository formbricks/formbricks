import { describe, expect, test } from "vitest";
import {
  type TV3PublicBlock,
  applySurveyBlockOperations,
  readPublicBlocks,
  remapBlockInvalidParamPath,
  reorderSurveyBlocks,
} from "./blocks";
import type { TV3SurveyBlockOp } from "./schemas";

const block = (id: string, name = id): TV3PublicBlock => ({
  id,
  name,
  elements: [{ id: `${id}-el`, type: "openText", headline: { "en-US": name }, required: false }],
});

const A = block("blk_a");
const B = block("blk_b");
const C = block("blk_c");
const current = [A, B, C];

const ids = (blocks: readonly TV3PublicBlock[]): string[] => blocks.map((b) => b.id);

const expectOk = <T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> => {
  expect(result.ok).toBe(true);
  return result as Extract<T, { ok: true }>;
};

const expectFail = <T extends { ok: boolean }>(result: T): Extract<T, { ok: false }> => {
  expect(result.ok).toBe(false);
  return result as Extract<T, { ok: false }>;
};

describe("readPublicBlocks", () => {
  test("returns a copy of a well-formed block array", () => {
    const result = readPublicBlocks({ blocks: current });
    expect(result).not.toBeNull();
    expect(result).not.toBe(current);
    expect(ids(result as TV3PublicBlock[])).toEqual(["blk_a", "blk_b", "blk_c"]);
  });

  test("rejects a non-array or an entry without a usable id", () => {
    expect(readPublicBlocks({ blocks: undefined })).toBeNull();
    expect(readPublicBlocks({ blocks: [{ name: "no id" }] })).toBeNull();
    expect(readPublicBlocks({ blocks: [{ id: "" }] })).toBeNull();
  });
});

describe("applySurveyBlockOperations — update", () => {
  test("replaces the whole block and keeps position", () => {
    const replacement = { id: "blk_b", name: "renamed", elements: [] };
    const result = expectOk(
      applySurveyBlockOperations(current, [{ op: "update", id: "blk_b", block: replacement }])
    );

    expect(ids(result.blocks)).toEqual(["blk_a", "blk_b", "blk_c"]);
    expect(result.blocks[1]).toEqual(replacement);
    expect(result.originOpIndexByBlockIndex.get(1)).toBe(0);
    expect(result.originOpIndexByBlockIndex.has(0)).toBe(false);
  });

  test("fills in an omitted block.id from the op id", () => {
    const result = expectOk(
      applySurveyBlockOperations(current, [{ op: "update", id: "blk_a", block: { name: "no id here" } }])
    );
    expect(result.blocks[0]).toEqual({ name: "no id here", id: "blk_a" });
  });

  test("rejects a block.id that contradicts the op id", () => {
    const result = expectFail(
      applySurveyBlockOperations(current, [
        { op: "update", id: "blk_a", block: { id: "blk_other", name: "x" } },
      ])
    );
    expect(result.invalidParams).toEqual([
      expect.objectContaining({
        name: "ops.0.block.id",
        code: "immutable_identifier",
        identifier: "blk_other",
      }),
    ]);
  });

  test("rejects an unknown target", () => {
    const result = expectFail(
      applySurveyBlockOperations(current, [{ op: "update", id: "blk_zz", block: { id: "blk_zz" } }])
    );
    expect(result.invalidParams).toEqual([
      expect.objectContaining({ name: "ops.0.id", code: "dangling_reference", missingId: "blk_zz" }),
    ]);
  });
});

describe("applySurveyBlockOperations — insert", () => {
  test.each([
    ["start", { type: "start" as const }, ["blk_new", "blk_a", "blk_b", "blk_c"]],
    ["end", { type: "end" as const }, ["blk_a", "blk_b", "blk_c", "blk_new"]],
    ["after", { type: "after" as const, blockId: "blk_a" }, ["blk_a", "blk_new", "blk_b", "blk_c"]],
  ])("positions a new block at %s", (_label, position, expected) => {
    const result = expectOk(
      applySurveyBlockOperations(current, [{ op: "insert", block: block("blk_new"), position }])
    );
    expect(ids(result.blocks)).toEqual(expected);
  });

  test("can anchor after a block inserted earlier in the same request", () => {
    const result = expectOk(
      applySurveyBlockOperations(current, [
        { op: "insert", block: block("blk_x"), position: { type: "start" } },
        { op: "insert", block: block("blk_y"), position: { type: "after", blockId: "blk_x" } },
      ])
    );
    expect(ids(result.blocks)).toEqual(["blk_x", "blk_y", "blk_a", "blk_b", "blk_c"]);
    expect(result.originOpIndexByBlockIndex.get(0)).toBe(0);
    expect(result.originOpIndexByBlockIndex.get(1)).toBe(1);
  });

  test("requires an id on the inserted block", () => {
    const result = expectFail(
      applySurveyBlockOperations(current, [
        { op: "insert", block: { name: "anonymous" }, position: { type: "end" } },
      ])
    );
    expect(result.invalidParams[0]).toMatchObject({
      name: "ops.0.block.id",
      code: "missing_required_field",
    });
  });

  test("rejects an id that already exists, and one inserted twice in the same request", () => {
    const clash = expectFail(
      applySurveyBlockOperations(current, [
        { op: "insert", block: block("blk_b"), position: { type: "end" } },
      ])
    );
    expect(clash.invalidParams[0]).toMatchObject({
      name: "ops.0.block.id",
      code: "duplicate_identifier",
      firstUsedAt: "blocks.1.id",
    });

    const twice = expectFail(
      applySurveyBlockOperations(current, [
        { op: "insert", block: block("blk_new"), position: { type: "end" } },
        { op: "insert", block: block("blk_new"), position: { type: "end" } },
      ])
    );
    expect(twice.failedOpIndex).toBe(1);
    expect(twice.invalidParams[0]).toMatchObject({ code: "duplicate_identifier" });
  });

  test("rejects an unknown anchor", () => {
    const result = expectFail(
      applySurveyBlockOperations(current, [
        { op: "insert", block: block("blk_new"), position: { type: "after", blockId: "blk_zz" } },
      ])
    );
    expect(result.invalidParams[0]).toMatchObject({
      name: "ops.0.position.blockId",
      code: "dangling_reference",
    });
  });
});

describe("applySurveyBlockOperations — remove and sequencing", () => {
  test("removes an existing block", () => {
    const result = expectOk(applySurveyBlockOperations(current, [{ op: "remove", id: "blk_b" }]));
    expect(ids(result.blocks)).toEqual(["blk_a", "blk_c"]);
  });

  test("rejects removing a block that is not there", () => {
    const result = expectFail(applySurveyBlockOperations(current, [{ op: "remove", id: "blk_zz" }]));
    expect(result.invalidParams[0]).toMatchObject({ name: "ops.0.id", code: "dangling_reference" });
  });

  test("a later op sees the effect of an earlier one", () => {
    const result = expectFail(
      applySurveyBlockOperations(current, [
        { op: "remove", id: "blk_b" },
        { op: "update", id: "blk_b", block: { id: "blk_b" } },
      ])
    );
    expect(result.failedOpIndex).toBe(1);
    expect(result.invalidParams[0]).toMatchObject({ name: "ops.1.id", code: "dangling_reference" });
  });

  test("remove-then-insert of the same id is allowed", () => {
    const result = expectOk(
      applySurveyBlockOperations(current, [
        { op: "remove", id: "blk_a" },
        { op: "insert", block: block("blk_a", "reborn"), position: { type: "end" } },
      ])
    );
    expect(ids(result.blocks)).toEqual(["blk_b", "blk_c", "blk_a"]);
  });

  test("emptying the survey is rejected once, at the end, not per-op", () => {
    // remove(only) -> insert(new) must stay legal, so the check cannot fire mid-sequence.
    const rescued = expectOk(
      applySurveyBlockOperations(
        [A],
        [
          { op: "remove", id: "blk_a" },
          { op: "insert", block: block("blk_new"), position: { type: "end" } },
        ]
      )
    );
    expect(ids(rescued.blocks)).toEqual(["blk_new"]);

    const emptied = expectFail(
      applySurveyBlockOperations(current, [
        { op: "remove", id: "blk_a" },
        { op: "remove", id: "blk_b" },
        { op: "remove", id: "blk_c" },
      ])
    );
    expect(emptied.failedOpIndex).toBe(2);
    expect(emptied.invalidParams[0].name).toBe("ops.2.id");
    expect(emptied.invalidParams[0].reason).toMatch(/no blocks/);
  });

  test("reports only the first failing op", () => {
    const result = expectFail(
      applySurveyBlockOperations(current, [
        { op: "remove", id: "nope_1" },
        { op: "remove", id: "nope_2" },
      ])
    );
    expect(result.failedOpIndex).toBe(0);
    expect(result.invalidParams).toHaveLength(1);
  });

  test("reports a summary and never mutates its inputs", () => {
    const ops: TV3SurveyBlockOp[] = [
      { op: "update", id: "blk_a", block: { id: "blk_a" } },
      { op: "insert", block: block("blk_new"), position: { type: "end" } },
      { op: "remove", id: "blk_c" },
    ];
    const snapshot = JSON.stringify(current);

    const result = expectOk(applySurveyBlockOperations(current, ops));

    expect(result.summary).toEqual({ opCount: 3, updateCount: 1, insertCount: 1, removeCount: 1 });
    expect(JSON.stringify(current)).toBe(snapshot);
  });
});

describe("reorderSurveyBlocks", () => {
  test("applies a permutation", () => {
    const result = expectOk(reorderSurveyBlocks(current, ["blk_c", "blk_a", "blk_b"]));
    expect(ids(result.blocks)).toEqual(["blk_c", "blk_a", "blk_b"]);
    expect(result.unchanged).toBe(false);
  });

  test("flags an order identical to the current one, so the caller can skip the write", () => {
    const result = expectOk(reorderSurveyBlocks(current, ["blk_a", "blk_b", "blk_c"]));
    expect(result.unchanged).toBe(true);
  });

  test("reports unknown, duplicate and missing ids together", () => {
    const result = expectFail(reorderSurveyBlocks(current, ["blk_a", "blk_a", "blk_zz"]));

    expect(result.invalidParams).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "order.1", code: "duplicate_identifier", firstUsedAt: "order.0" }),
        expect.objectContaining({ name: "order.2", code: "dangling_reference", missingId: "blk_zz" }),
        expect.objectContaining({ name: "order", code: "missing_required_field", missingId: "blk_b" }),
        expect.objectContaining({ name: "order", code: "missing_required_field", missingId: "blk_c" }),
      ])
    );
  });

  test("a dropped block is caught — the failure whole-array replacement misses", () => {
    const result = expectFail(reorderSurveyBlocks(current, ["blk_a", "blk_b"]));
    expect(result.invalidParams).toEqual([
      expect.objectContaining({ code: "missing_required_field", missingId: "blk_c" }),
    ]);
  });
});

describe("remapBlockInvalidParamPath", () => {
  const origins = new Map([[1, 3]]);

  test("rewrites a path into a block the request touched", () => {
    expect(
      remapBlockInvalidParamPath({ name: "blocks.1.elements.0.headline", reason: "r" }, origins)
    ).toMatchObject({ name: "ops.3.block.elements.0.headline" });
  });

  test("rewrites a bare block path", () => {
    expect(remapBlockInvalidParamPath({ name: "blocks.1", reason: "r" }, origins)).toMatchObject({
      name: "ops.3.block",
    });
  });

  test("leaves untouched blocks and non-block paths alone", () => {
    expect(remapBlockInvalidParamPath({ name: "blocks.0.logic.0", reason: "r" }, origins).name).toBe(
      "blocks.0.logic.0"
    );
    expect(remapBlockInvalidParamPath({ name: "endings.0.headline", reason: "r" }, origins).name).toBe(
      "endings.0.headline"
    );
  });

  test("preserves every other field on the param", () => {
    const param = {
      name: "blocks.1.id",
      reason: "r",
      code: "duplicate_identifier" as const,
      identifier: "x",
    };
    expect(remapBlockInvalidParamPath(param, origins)).toEqual({ ...param, name: "ops.3.block.id" });
  });
});
