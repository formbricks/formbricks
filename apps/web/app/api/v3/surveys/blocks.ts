import type { InvalidParam } from "@/app/api/v3/lib/response";
import type { TV3SurveyBlockOp } from "./schemas";

/**
 * Pure block-list operations for the v3 block-editing endpoints (ENG-3069).
 *
 * These run over the **public** block shape — `serializeV3SurveyResource(survey).blocks`, i.e. the
 * exact array `GET /api/v3/surveys/{surveyId}` returns — and hand the result to the ordinary patch
 * pipeline as `{ blocks }`. That matters: the patch schema normalizes locale-keyed i18n maps
 * (`{"en-US": …}`) into the internal `{default: …}` shape and *rejects* a literal `default` key, so
 * splicing caller-supplied blocks into the internal document instead would fail validation. The
 * public serializer emits every configured language and fabricates no fallbacks, so a spliced array
 * is indistinguishable from what a GET → modify → PATCH client sends today.
 *
 * No I/O, no `server-only`: everything here is a pure function of its arguments.
 */

export type TV3PublicBlock = Record<string, unknown> & { id: string };

export type TV3BlockOpsSummary = {
  opCount: number;
  updateCount: number;
  insertCount: number;
  removeCount: number;
};

export type TV3BlockOpsResult =
  | {
      ok: true;
      blocks: TV3PublicBlock[];
      /** Final block index → the op that produced it, for remapping downstream `blocks.<i>` paths. */
      originOpIndexByBlockIndex: ReadonlyMap<number, number>;
      summary: TV3BlockOpsSummary;
    }
  | { ok: false; invalidParams: InvalidParam[]; failedOpIndex: number; summary: TV3BlockOpsSummary };

export type TV3BlockReorderResult =
  | { ok: true; unchanged: boolean; blocks: TV3PublicBlock[] }
  | { ok: false; invalidParams: InvalidParam[] };

function isPublicBlock(value: unknown): value is TV3PublicBlock {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { id?: unknown }).id === "string" &&
    (value as { id: string }).id.length > 0
  );
}

/**
 * Narrow the serialized resource's `blocks` to an array of id-bearing objects. A survey that cannot
 * satisfy this is not editable through these endpoints; the caller maps the `null` to a 422 rather
 * than letting a downstream `undefined` surface as a 500.
 */
export function readPublicBlocks(resource: { blocks: unknown }): TV3PublicBlock[] | null {
  if (!Array.isArray(resource.blocks)) {
    return null;
  }

  return resource.blocks.every(isPublicBlock) ? [...(resource.blocks as TV3PublicBlock[])] : null;
}

function blockIdOf(block: Record<string, unknown>): string | null {
  const id = block.id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function summarize(ops: readonly TV3SurveyBlockOp[]): TV3BlockOpsSummary {
  return {
    opCount: ops.length,
    updateCount: ops.filter((op) => op.op === "update").length,
    insertCount: ops.filter((op) => op.op === "insert").length,
    removeCount: ops.filter((op) => op.op === "remove").length,
  };
}

/**
 * Apply `ops` in order to a copy of `currentBlocks`.
 *
 * Fail-fast: after one op fails, every later op would be judged against a state that never exists,
 * so only the failing op's issues are reported. Emptiness is checked once at the end rather than
 * per-op, because `remove(only) → insert(new)` is legitimate and a per-op check would reject it.
 */
export function applySurveyBlockOperations(
  currentBlocks: readonly TV3PublicBlock[],
  ops: readonly TV3SurveyBlockOp[]
): TV3BlockOpsResult {
  const summary = summarize(ops);
  const working: TV3PublicBlock[] = [...currentBlocks];
  // null = untouched by this request, so a downstream issue keeps its `blocks.<i>` path.
  const origins: (number | null)[] = currentBlocks.map(() => null);

  const fail = (failedOpIndex: number, invalidParams: InvalidParam[]): TV3BlockOpsResult => ({
    ok: false,
    invalidParams,
    failedOpIndex,
    summary,
  });

  for (const [opIndex, op] of ops.entries()) {
    if (op.op === "update") {
      const targetIndex = working.findIndex((block) => block.id === op.id);
      if (targetIndex === -1) {
        return fail(opIndex, [
          {
            name: `ops.${opIndex}.id`,
            reason: `Block '${op.id}' does not exist on this survey`,
            code: "dangling_reference",
            identifier: op.id,
            referenceType: "block",
            missingId: op.id,
          },
        ]);
      }

      const suppliedId = blockIdOf(op.block);
      if (suppliedId !== null && suppliedId !== op.id) {
        return fail(opIndex, [
          {
            name: `ops.${opIndex}.block.id`,
            reason: "block.id must equal the op id; use remove + insert to give a block a new id",
            code: "immutable_identifier",
            identifier: suppliedId,
            referenceType: "block",
          },
        ]);
      }

      working[targetIndex] = { ...op.block, id: op.id };
      origins[targetIndex] = opIndex;
      continue;
    }

    if (op.op === "insert") {
      const newId = blockIdOf(op.block);
      if (newId === null) {
        return fail(opIndex, [
          {
            name: `ops.${opIndex}.block.id`,
            reason: "An inserted block must carry its own id",
            code: "missing_required_field",
            referenceType: "block",
          },
        ]);
      }

      const existingIndex = working.findIndex((block) => block.id === newId);
      if (existingIndex !== -1) {
        return fail(opIndex, [
          {
            name: `ops.${opIndex}.block.id`,
            reason: `Block '${newId}' already exists on this survey`,
            code: "duplicate_identifier",
            identifier: newId,
            referenceType: "block",
            firstUsedAt: `blocks.${existingIndex}.id`,
          },
        ]);
      }

      let insertAt: number;
      if (op.position.type === "start") {
        insertAt = 0;
      } else if (op.position.type === "end") {
        insertAt = working.length;
      } else {
        const anchorIndex = working.findIndex((block) => block.id === op.position.blockId);
        if (anchorIndex === -1) {
          return fail(opIndex, [
            {
              name: `ops.${opIndex}.position.blockId`,
              reason: `Block '${op.position.blockId}' does not exist on this survey`,
              code: "dangling_reference",
              identifier: op.position.blockId,
              referenceType: "block",
              missingId: op.position.blockId,
            },
          ]);
        }
        insertAt = anchorIndex + 1;
      }

      working.splice(insertAt, 0, { ...op.block, id: newId });
      origins.splice(insertAt, 0, opIndex);
      continue;
    }

    const removeIndex = working.findIndex((block) => block.id === op.id);
    if (removeIndex === -1) {
      return fail(opIndex, [
        {
          name: `ops.${opIndex}.id`,
          reason: `Block '${op.id}' does not exist on this survey`,
          code: "dangling_reference",
          identifier: op.id,
          referenceType: "block",
          missingId: op.id,
        },
      ]);
    }

    working.splice(removeIndex, 1);
    origins.splice(removeIndex, 1);
  }

  if (working.length === 0) {
    // Attributed to the last op: reaching an empty list means the last op was necessarily a remove.
    return fail(ops.length - 1, [
      {
        name: `ops.${ops.length - 1}.id`,
        reason: "These operations would leave the survey with no blocks; a survey needs at least one",
        referenceType: "block",
      },
    ]);
  }

  const originOpIndexByBlockIndex = new Map<number, number>();
  origins.forEach((opIndex, blockIndex) => {
    if (opIndex !== null) {
      originOpIndexByBlockIndex.set(blockIndex, opIndex);
    }
  });

  return { ok: true, blocks: working, originOpIndexByBlockIndex, summary };
}

/**
 * Replace the block order with `order`, which must be a permutation of the stored block ids.
 *
 * Set equality is the whole validation, and it is worth more than it looks: it independently catches
 * a dropped block — the exact silent failure whole-array replacement suffers from. Unknown, missing
 * and duplicate ids are reported together, because unlike `ops` there is no sequential dependency
 * that makes later diagnostics meaningless.
 */
export function reorderSurveyBlocks(
  currentBlocks: readonly TV3PublicBlock[],
  order: readonly string[]
): TV3BlockReorderResult {
  const byId = new Map(currentBlocks.map((block) => [block.id, block]));
  const invalidParams: InvalidParam[] = [];
  const seenAt = new Map<string, number>();

  order.forEach((id, index) => {
    const firstIndex = seenAt.get(id);
    if (firstIndex !== undefined) {
      invalidParams.push({
        name: `order.${index}`,
        reason: `Block '${id}' is listed more than once`,
        code: "duplicate_identifier",
        identifier: id,
        referenceType: "block",
        firstUsedAt: `order.${firstIndex}`,
      });
      return;
    }
    seenAt.set(id, index);

    if (!byId.has(id)) {
      invalidParams.push({
        name: `order.${index}`,
        reason: `Block '${id}' does not exist on this survey`,
        code: "dangling_reference",
        identifier: id,
        referenceType: "block",
        missingId: id,
      });
    }
  });

  for (const block of currentBlocks) {
    if (!seenAt.has(block.id)) {
      invalidParams.push({
        name: "order",
        reason: `Block '${block.id}' is missing from the order; list every block exactly once`,
        code: "missing_required_field",
        identifier: block.id,
        referenceType: "block",
        missingId: block.id,
      });
    }
  }

  if (invalidParams.length > 0) {
    return { ok: false, invalidParams };
  }

  const unchanged = currentBlocks.every((block, index) => block.id === order[index]);

  return {
    ok: true,
    unchanged,
    blocks: order.map((id) => byId.get(id) as TV3PublicBlock),
  };
}

/**
 * Rewrite a downstream `blocks.<i>.…` path to `ops.<n>.block.…` when block `<i>` came from an op.
 *
 * Without this, "blocks.7.elements.0.headline" after five inserts is unactionable — the caller never
 * sent a `blocks` array. Blocks the request did not touch keep their `blocks.<i>` path on purpose:
 * a dangling jump target in an untouched block really is a problem with the stored document, not
 * with any op.
 */
export function remapBlockInvalidParamPath(
  param: InvalidParam,
  originOpIndexByBlockIndex: ReadonlyMap<number, number>
): InvalidParam {
  const match = /^blocks\.(\d+)(?<rest>\..*)?$/.exec(param.name);
  if (!match) {
    return param;
  }

  const opIndex = originOpIndexByBlockIndex.get(Number(match[1]));
  if (opIndex === undefined) {
    return param;
  }

  return { ...param, name: `ops.${opIndex}.block${match.groups?.rest ?? ""}` };
}
