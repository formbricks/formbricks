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

/** The first block id that occurs twice, with both positions, or `null` when every id is unique. */
export function findDuplicateBlockId(
  blocks: readonly TV3PublicBlock[]
): { id: string; firstIndex: number; index: number } | null {
  const firstIndexById = new Map<string, number>();
  for (const [index, block] of blocks.entries()) {
    const firstIndex = firstIndexById.get(block.id);
    if (firstIndex !== undefined) {
      return { id: block.id, firstIndex, index };
    }
    firstIndexById.set(block.id, index);
  }
  return null;
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

/**
 * Cap on reported reorder diagnostics.
 *
 * `reorderSurveyBlocks` emits one entry per unknown or repeated id, so a body full of junk ids turns
 * into a response several times its own size — the 2 MB request bound does not bound the response.
 * Report enough to act on, then say how many were left out. ENG-1652's policy, applied to an output.
 *
 * The cap has to bound the *building*, not just the reply. Capping only the reply still allocates one
 * six-field object with three template strings per entry and then throws almost all of them away: a
 * 2 MB body of repeated ids is ~419k entries, which measured at ~500 MB of transient heap for an 8 KB
 * 422. So `OrderDiagnostics` stops allocating at the cap and only keeps counting — the reported
 * prefix is byte-identical to before for every input, and the work is now bounded by the cap rather
 * than by the body size.
 */
const V3_BLOCK_ORDER_MAX_DIAGNOSTICS = 50;

/**
 * Collects at most `V3_BLOCK_ORDER_MAX_DIAGNOSTICS` diagnostics, counting the rest without building
 * them. `push` takes a thunk so the caller's object literal — and its template strings — are never
 * evaluated once the cap is reached.
 */
class OrderDiagnostics {
  private readonly kept: InvalidParam[] = [];
  private omitted = 0;

  push(build: () => InvalidParam): void {
    if (this.kept.length < V3_BLOCK_ORDER_MAX_DIAGNOSTICS) {
      this.kept.push(build());
      return;
    }
    this.omitted += 1;
  }

  get empty(): boolean {
    return this.kept.length === 0 && this.omitted === 0;
  }

  report(): InvalidParam[] {
    if (this.omitted === 0) {
      return this.kept;
    }

    return [
      ...this.kept,
      {
        name: "order",
        reason: `${this.omitted} further problems with this order were not reported; fix the ones above and retry`,
      },
    ];
  }
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

type TV3BlockUpdateOp = Extract<TV3SurveyBlockOp, { op: "update" }>;
type TV3BlockInsertOp = Extract<TV3SurveyBlockOp, { op: "insert" }>;
type TV3BlockRemoveOp = Extract<TV3SurveyBlockOp, { op: "remove" }>;

/**
 * The block list being built, and in parallel which op produced each entry.
 * `origins[i] === null` means block `i` is untouched by this request, so a downstream issue keeps its
 * `blocks.<i>` path instead of being remapped onto an op the caller never sent.
 */
type TWorkingBlocks = {
  blocks: TV3PublicBlock[];
  origins: (number | null)[];
};

/** `null` = the op applied; otherwise the issues that stopped it. */
type TOpOutcome = InvalidParam[] | null;

function danglingBlockIssue(name: string, id: string): InvalidParam {
  return {
    name,
    reason: `Block '${id}' does not exist on this survey`,
    code: "dangling_reference",
    identifier: id,
    referenceType: "block",
    missingId: id,
  };
}

function applyUpdateOp(state: TWorkingBlocks, opIndex: number, op: TV3BlockUpdateOp): TOpOutcome {
  const targetIndex = state.blocks.findIndex((block) => block.id === op.id);
  if (targetIndex === -1) {
    return [danglingBlockIssue(`ops.${opIndex}.id`, op.id)];
  }

  const suppliedId = blockIdOf(op.block);
  if (suppliedId !== null && suppliedId !== op.id) {
    return [
      {
        name: `ops.${opIndex}.block.id`,
        reason: "block.id must equal the op id; use remove + insert to give a block a new id",
        code: "immutable_identifier",
        identifier: suppliedId,
        referenceType: "block",
      },
    ];
  }

  state.blocks[targetIndex] = { ...op.block, id: op.id };
  state.origins[targetIndex] = opIndex;
  return null;
}

function resolveInsertIndex(
  state: TWorkingBlocks,
  opIndex: number,
  position: TV3BlockInsertOp["position"]
): { ok: true; index: number } | { ok: false; invalidParams: InvalidParam[] } {
  if (position.type === "start") {
    return { ok: true, index: 0 };
  }
  if (position.type === "end") {
    return { ok: true, index: state.blocks.length };
  }

  const anchorIndex = state.blocks.findIndex((block) => block.id === position.blockId);
  return anchorIndex === -1
    ? {
        ok: false,
        invalidParams: [danglingBlockIssue(`ops.${opIndex}.position.blockId`, position.blockId)],
      }
    : { ok: true, index: anchorIndex + 1 };
}

function applyInsertOp(state: TWorkingBlocks, opIndex: number, op: TV3BlockInsertOp): TOpOutcome {
  const newId = blockIdOf(op.block);
  if (newId === null) {
    return [
      {
        name: `ops.${opIndex}.block.id`,
        reason: "An inserted block must carry its own id",
        code: "missing_required_field",
        referenceType: "block",
      },
    ];
  }

  const existingIndex = state.blocks.findIndex((block) => block.id === newId);
  if (existingIndex !== -1) {
    // The other copy is either a stored block (keep the `blocks.<i>` path — that is where it is) or
    // one an earlier op in this request inserted, in which case `blocks.<i>` names an array the
    // caller never sent and the actionable path is that op's payload.
    const existingOrigin = state.origins[existingIndex];
    return [
      {
        name: `ops.${opIndex}.block.id`,
        reason: `Block '${newId}' already exists on this survey`,
        code: "duplicate_identifier",
        identifier: newId,
        referenceType: "block",
        firstUsedAt:
          existingOrigin === null ? `blocks.${existingIndex}.id` : `ops.${existingOrigin}.block.id`,
      },
    ];
  }

  const position = resolveInsertIndex(state, opIndex, op.position);
  if (!position.ok) {
    return position.invalidParams;
  }

  state.blocks.splice(position.index, 0, { ...op.block, id: newId });
  state.origins.splice(position.index, 0, opIndex);
  return null;
}

function applyRemoveOp(state: TWorkingBlocks, opIndex: number, op: TV3BlockRemoveOp): TOpOutcome {
  const removeIndex = state.blocks.findIndex((block) => block.id === op.id);
  if (removeIndex === -1) {
    return [danglingBlockIssue(`ops.${opIndex}.id`, op.id)];
  }

  state.blocks.splice(removeIndex, 1);
  state.origins.splice(removeIndex, 1);
  return null;
}

function applyOp(state: TWorkingBlocks, opIndex: number, op: TV3SurveyBlockOp): TOpOutcome {
  if (op.op === "update") {
    return applyUpdateOp(state, opIndex, op);
  }
  if (op.op === "insert") {
    return applyInsertOp(state, opIndex, op);
  }
  return applyRemoveOp(state, opIndex, op);
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
  const state: TWorkingBlocks = {
    blocks: [...currentBlocks],
    origins: currentBlocks.map(() => null),
  };

  for (const [opIndex, op] of ops.entries()) {
    const invalidParams = applyOp(state, opIndex, op);
    if (invalidParams) {
      return { ok: false, invalidParams, failedOpIndex: opIndex, summary };
    }
  }

  if (state.blocks.length === 0) {
    // Attributed to the last op: reaching an empty list means the last op was necessarily a remove.
    return {
      ok: false,
      invalidParams: [
        {
          name: `ops.${ops.length - 1}.id`,
          reason: "These operations would leave the survey with no blocks; a survey needs at least one",
          referenceType: "block",
        },
      ],
      failedOpIndex: ops.length - 1,
      summary,
    };
  }

  const originOpIndexByBlockIndex = new Map<number, number>();
  state.origins.forEach((opIndex, blockIndex) => {
    if (opIndex !== null) {
      originOpIndexByBlockIndex.set(blockIndex, opIndex);
    }
  });

  return { ok: true, blocks: state.blocks, originOpIndexByBlockIndex, summary };
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
  const diagnostics = new OrderDiagnostics();
  const seenAt = new Map<string, number>();

  order.forEach((id, index) => {
    const firstIndex = seenAt.get(id);
    if (firstIndex !== undefined) {
      diagnostics.push(() => ({
        name: `order.${index}`,
        reason: `Block '${id}' is listed more than once`,
        code: "duplicate_identifier",
        identifier: id,
        referenceType: "block",
        firstUsedAt: `order.${firstIndex}`,
      }));
      return;
    }
    seenAt.set(id, index);

    if (!byId.has(id)) {
      diagnostics.push(() => ({
        name: `order.${index}`,
        reason: `Block '${id}' does not exist on this survey`,
        code: "dangling_reference",
        identifier: id,
        referenceType: "block",
        missingId: id,
      }));
    }
  });

  for (const block of currentBlocks) {
    if (!seenAt.has(block.id)) {
      diagnostics.push(() => ({
        name: "order",
        reason: `Block '${block.id}' is missing from the order; list every block exactly once`,
        code: "missing_required_field",
        identifier: block.id,
        referenceType: "block",
        missingId: block.id,
      }));
    }
  }

  if (!diagnostics.empty) {
    return { ok: false, invalidParams: diagnostics.report() };
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
  const remap = (path: string): string => {
    const match = /^blocks\.(\d+)(?<rest>\..*)?$/.exec(path);
    if (!match) {
      return path;
    }
    const opIndex = originOpIndexByBlockIndex.get(Number(match[1]));
    return opIndex === undefined ? path : `ops.${opIndex}.block${match.groups?.rest ?? ""}`;
  };

  /**
   * The same rewrite for paths quoted inside prose rather than held in a field of their own.
   *
   * Several reasons name the other end of a problem in words — "first used at blocks.3.elements.1",
   * "conflicts with … at …", the recall reasons naming the element they point at. Remapping only the
   * structured fields leaves those sentences in `blocks.<i>` coordinates beside a `name` that now
   * reads `ops.<n>.block`, so one param contradicts itself and half of it names an array the caller
   * never sent. Unanchored on purpose — the path sits mid-sentence — and still keyed by the same map,
   * so a quoted path into a block the request did not touch is left exactly as it is.
   */
  const remapWithin = (text: string): string =>
    text.replace(/blocks\.(\d+)((?:\.[A-Za-z0-9_-]+)*)/g, (whole, index: string, rest: string) => {
      const opIndex = originOpIndexByBlockIndex.get(Number(index));
      return opIndex === undefined ? whole : `ops.${opIndex}.block${rest}`;
    });

  // `firstUsedAt` and `conflictsWith` are paths too — a duplicate-id report names both copies. Leaving
  // them in `blocks.<i>` coordinates while `name` moves to `ops.<n>` hands the caller a half-translated
  // pair it cannot resolve without a second GET.
  return {
    ...param,
    name: remap(param.name),
    reason: remapWithin(param.reason),
    ...(param.firstUsedAt === undefined ? {} : { firstUsedAt: remap(param.firstUsedAt) }),
    ...(param.conflictsWith === undefined ? {} : { conflictsWith: remap(param.conflictsWith) }),
  };
}
