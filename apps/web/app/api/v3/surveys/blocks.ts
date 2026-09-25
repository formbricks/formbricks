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

/**
 * Final block index → where the caller can find that block, as a path prefix: `ops.<n>.block` for a
 * block an op produced, `blocks.<j>` with the *stored* index for one the request did not touch. The
 * document that gets validated is the post-op array, so every `blocks.<i>` a downstream check reports
 * is in coordinates the caller never saw; this map translates them back.
 */
export type TV3BlockPathByIndex = ReadonlyMap<number, string>;

export type TV3BlockOpsResult =
  | {
      ok: true;
      blocks: TV3PublicBlock[];
      blockPathByIndex: TV3BlockPathByIndex;
      summary: TV3BlockOpsSummary;
    }
  | { ok: false; invalidParams: InvalidParam[]; failedOpIndex: number; summary: TV3BlockOpsSummary };

export type TV3BlockReorderResult =
  | { ok: true; unchanged: boolean; blocks: TV3PublicBlock[]; blockPathByIndex: TV3BlockPathByIndex }
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

/** Where an entry of the working list came from: an op in this request, or a position in the stored survey. */
type TBlockOrigin = { op: number } | { stored: number };

/**
 * The block list being built, and in parallel where each entry came from. An untouched block keeps its
 * *stored* index here even after earlier entries are inserted or removed, so a downstream issue in it
 * is reported at the path the caller can see in GET rather than at its post-op position.
 */
type TWorkingBlocks = {
  blocks: TV3PublicBlock[];
  origins: TBlockOrigin[];
};

function originPath(origin: TBlockOrigin): string {
  return "op" in origin ? `ops.${origin.op}.block` : `blocks.${origin.stored}`;
}

function toBlockPathByIndex(origins: readonly TBlockOrigin[]): TV3BlockPathByIndex {
  return new Map(origins.map((origin, index) => [index, originPath(origin)]));
}

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
  state.origins[targetIndex] = { op: opIndex };
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
    // The other copy is either a stored block (name it by its stored index — that is where GET shows
    // it) or one an earlier op in this request inserted, in which case the actionable path is that
    // op's payload.
    return [
      {
        name: `ops.${opIndex}.block.id`,
        reason: `Block '${newId}' already exists on this survey`,
        code: "duplicate_identifier",
        identifier: newId,
        referenceType: "block",
        firstUsedAt: `${originPath(state.origins[existingIndex])}.id`,
      },
    ];
  }

  const position = resolveInsertIndex(state, opIndex, op.position);
  if (!position.ok) {
    return position.invalidParams;
  }

  state.blocks.splice(position.index, 0, { ...op.block, id: newId });
  state.origins.splice(position.index, 0, { op: opIndex });
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
    origins: currentBlocks.map((_block, index) => ({ stored: index })),
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

  return { ok: true, blocks: state.blocks, blockPathByIndex: toBlockPathByIndex(state.origins), summary };
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
  const stored = new Map(currentBlocks.map((block, index) => [block.id, { block, index }]));
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

    if (!stored.has(id)) {
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
  // Safe: no diagnostics means every id in `order` resolved.
  const reordered = order.map((id) => stored.get(id) as { block: TV3PublicBlock; index: number });

  return {
    ok: true,
    unchanged,
    blocks: reordered.map(({ block }) => block),
    blockPathByIndex: new Map(
      reordered.map(({ index: storedIndex }, index) => [index, `blocks.${storedIndex}`])
    ),
  };
}

/**
 * Rewrite a downstream `blocks.<i>.…` path — indexed against the post-op array — to where the caller
 * can find it: `ops.<n>.block.…` when block `<i>` came from an op, `blocks.<j>.…` with the stored index
 * when it did not.
 *
 * Without this, "blocks.7.elements.0.headline" after five inserts is unactionable — the caller never
 * sent a `blocks` array — and "blocks.1.logic.0" after one remove names a different block than the
 * caller's GET does. An untouched block's problem really is a problem with the stored document, so it
 * is reported at the stored coordinates, not at whatever slot it occupies after the ops.
 */
export function remapBlockInvalidParamPath(
  param: InvalidParam,
  blockPathByIndex: TV3BlockPathByIndex
): InvalidParam {
  const remap = (path: string): string => {
    const match = /^blocks\.(\d+)(?<rest>\..*)?$/.exec(path);
    if (!match) {
      return path;
    }
    const prefix = blockPathByIndex.get(Number(match[1]));
    return prefix === undefined ? path : `${prefix}${match.groups?.rest ?? ""}`;
  };

  /**
   * The same rewrite for paths quoted inside prose rather than held in a field of their own.
   *
   * Several reasons name the other end of a problem in words — "first used at blocks.3.elements.1",
   * "conflicts with … at …", the recall reasons naming the element they point at. Remapping only the
   * structured fields leaves those sentences in `blocks.<i>` coordinates beside a `name` that now
   * reads `ops.<n>.block`, so one param contradicts itself and half of it names an array the caller
   * never sent. Unanchored on purpose — the path sits mid-sentence — and keyed by the same map, so a
   * quoted path is translated exactly as a structured one is.
   */
  const remapWithin = (text: string): string =>
    text.replace(/blocks\.(\d+)((?:\.[A-Za-z0-9_-]+)*)/g, (whole, index: string, rest: string) => {
      const prefix = blockPathByIndex.get(Number(index));
      return prefix === undefined ? whole : `${prefix}${rest}`;
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
