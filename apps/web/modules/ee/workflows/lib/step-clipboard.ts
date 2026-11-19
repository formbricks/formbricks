import { createId } from "@paralleldrive/cuid2";
import type { TWorkflowDefinition } from "@formbricks/workflows";
import {
  type TWorkflowCanvasDirection,
  getAppendedStepPosition,
} from "@/modules/ee/workflows/lib/canvas-geometry";
import { getBranchHandles, getBranchLegOffset } from "@/modules/ee/workflows/lib/workflow-steps";

/**
 * Cut, copy and paste of steps on the canvas. What is cut or copied is a step and every step after it
 * on its path (an If/else or Switch with its branches): branches never join (ADR 0047), so that is a
 * self-contained piece of the graph. The clipboard holds one such piece.
 *
 * - Cut leaves the steps where they are, faded, until they are pasted: pasting moves the same steps,
 *   ids and stored secrets included. Escape, Undo, or another cut or copy puts them back.
 * - Copy keeps a snapshot; each paste adds fresh steps with new ids. Secret header values are not
 *   copied, as when a workflow is duplicated: each needs its value entered again.
 * - Paste goes where a `+` is: at the end of a path, at the start of an empty branch, or on a line
 *   between two steps. On a line, the step that followed carries on from the end of the pasted steps
 *   (through the first branch where they fork), and it and everything after it move along to make room.
 */

type TStepNode = TWorkflowDefinition["nodes"][number];
type TStepEdge = TWorkflowDefinition["edges"][number];

export type TStepClipboard =
  | { mode: "cut"; workflowId: string; rootId: string; stepIds: string[] }
  | { mode: "copy"; workflowId: string; rootId: string; nodes: TStepNode[]; edges: TStepEdge[] };

/** Where a `+` pastes: on a line, or after a step (with a branch, at the start of that branch). */
export type TPasteTarget = { edgeId: string } | { sourceNodeId: string; branch?: string };

const isEdgeTarget = (target: TPasteTarget): target is { edgeId: string } => "edgeId" in target;

/** The step and every step after it on its path, root first. */
export const getStepAndAfter = (definition: TWorkflowDefinition, rootId: string): string[] => {
  const ids: string[] = [];
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (ids.includes(id) || id === definition.trigger?.id) continue;
    ids.push(id);
    for (const edge of definition.edges) if (edge.source === id) queue.push(edge.target);
  }
  return ids;
};

/** A copy of the piece as it is now; later edits to the originals don't change what pastes. */
export const captureStepCopy = (
  definition: TWorkflowDefinition,
  rootId: string
): { nodes: TStepNode[]; edges: TStepEdge[] } => {
  const ids = new Set(getStepAndAfter(definition, rootId));
  return structuredClone({
    nodes: definition.nodes.filter((node) => ids.has(node.id)),
    edges: definition.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)),
  });
};

/** Whether a `+` can take the clipboard: never inside the piece being moved. */
export const canPasteAt = (
  definition: TWorkflowDefinition,
  clipboard: TStepClipboard | null,
  target: TPasteTarget
): boolean => {
  if (!clipboard) return false;
  if (clipboard.mode === "copy") return true;
  const moving = new Set(clipboard.stepIds);
  if (isEdgeTarget(target)) {
    const edge = definition.edges.find((item) => item.id === target.edgeId);
    // The line into the piece itself is where it already is.
    return edge !== undefined && !moving.has(edge.source) && edge.target !== clipboard.rootId;
  }
  return !moving.has(target.sourceNodeId);
};

const positionOf = (definition: TWorkflowDefinition, id: string) =>
  definition.trigger?.id === id
    ? definition.trigger.ui?.position
    : definition.nodes.find((node) => node.id === id)?.ui?.position;

/** Where the piece's path ends: follow the first branch of each fork to its last step. */
const findOpenEnd = (
  nodes: readonly TStepNode[],
  edges: readonly TStepEdge[],
  rootId: string
): { nodeId: string; branch?: string } => {
  let nodeId = rootId;
  for (let guard = 0; guard <= nodes.length; guard++) {
    const node = nodes.find((item) => item.id === nodeId);
    const branch = node ? getBranchHandles(node)?.[0] : undefined;
    const next = edges.find(
      (edge) => edge.source === nodeId && (branch === undefined || edge.sourceHandle === branch)
    );
    if (!next) return branch === undefined ? { nodeId } : { nodeId, branch };
    nodeId = next.target;
  }
  return { nodeId };
};

const withSecretValuesDropped = (node: TStepNode): TStepNode => {
  if (node.type !== "action" || node.actionType !== "http_request") return node;
  return {
    ...node,
    config: {
      ...node.config,
      headers: node.config.headers.map((header) =>
        header.secret === true ? { name: header.name, secret: true } : header
      ),
    },
  };
};

/**
 * Fresh steps from a copy: new ids, edges between them remapped, a Variable that reads a copied step
 * (`steps.<id>.…`) pointed at its copy, and secret header values dropped.
 */
const instantiateCopy = (
  clipboard: Extract<TStepClipboard, { mode: "copy" }>,
  copyLabel: (node: TStepNode) => string
): { nodes: TStepNode[]; edges: TStepEdge[]; rootId: string } => {
  const ids = new Map(clipboard.nodes.map((node) => [node.id, createId()]));
  const remap = (text: string) =>
    [...ids].reduce((current, [from, to]) => current.replaceAll(`steps.${from}.`, `steps.${to}.`), text);
  const nodes = clipboard.nodes.map((node) => {
    const copied = JSON.parse(remap(JSON.stringify(withSecretValuesDropped(node)))) as TStepNode;
    return { ...copied, id: ids.get(node.id)!, label: copyLabel(node) };
  });
  const edges = clipboard.edges.map((edge) => ({
    ...edge,
    id: createId(),
    source: ids.get(edge.source)!,
    target: ids.get(edge.target)!,
  }));
  return { nodes, edges, rootId: ids.get(clipboard.rootId)! };
};

/** Every step after `fromId`, itself included. */
const descendantsOf = (edges: readonly TStepEdge[], fromId: string): Set<string> => {
  const found = new Set([fromId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const edge of edges) {
      if (found.has(edge.source) && !found.has(edge.target)) {
        found.add(edge.target);
        grew = true;
      }
    }
  }
  return found;
};

const moveBy = (nodes: Iterable<TStepNode>, shift: { x: number; y: number }) => {
  for (const node of nodes) {
    const position = node.ui?.position;
    if (position) node.ui = { ...node.ui, position: { x: position.x + shift.x, y: position.y + shift.y } };
  }
};

export type TPasteResult = {
  definition: TWorkflowDefinition;
  /** The pasted piece's first step, to select. */
  rootId: string;
  /** How many steps were added (a copy) or moved (a cut). */
  stepCount: number;
};

type TPiece = { nodes: TStepNode[]; edges: TStepEdge[]; rootId: string };

/** The steps to place: a cut's own steps, detached from where they were, or a copy's fresh ones. */
const takePiece = (
  next: TWorkflowDefinition,
  clipboard: TStepClipboard,
  copyLabel: (node: TStepNode) => string
): TPiece => {
  if (clipboard.mode === "copy") {
    const piece = instantiateCopy(clipboard, copyLabel);
    next.nodes.push(...piece.nodes);
    next.edges.push(...piece.edges);
    return piece;
  }
  const ids = new Set(clipboard.stepIds);
  // Detach the piece from where it was; the step before it becomes an end again.
  next.edges = next.edges.filter((edge) => !(edge.target === clipboard.rootId && !ids.has(edge.source)));
  return {
    nodes: next.nodes.filter((node) => ids.has(node.id)),
    edges: next.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)),
    rootId: clipboard.rootId,
  };
};

type TAnchor = {
  source: string;
  sourceHandle?: string;
  /** On a line: the step that followed, which carries on after the piece. */
  following?: string;
  rootPosition?: { x: number; y: number };
};

/** What the piece hangs from and where its first step lands; a line is taken out of the way. */
const resolveAnchor = (
  next: TWorkflowDefinition,
  target: TPasteTarget,
  direction: TWorkflowCanvasDirection
): TAnchor | null => {
  if (isEdgeTarget(target)) {
    const edge = next.edges.find((item) => item.id === target.edgeId);
    if (!edge) return null;
    next.edges = next.edges.filter((item) => item.id !== edge.id);
    return {
      source: edge.source,
      sourceHandle: edge.sourceHandle ?? undefined,
      following: edge.target,
      rootPosition: positionOf(next, edge.target),
    };
  }
  const sourceNode = next.nodes.find((node) => node.id === target.sourceNodeId);
  const sourcePosition = positionOf(next, target.sourceNodeId);
  const legOffset =
    target.branch !== undefined && sourceNode
      ? getBranchLegOffset(next, sourceNode, target.branch, direction)
      : null;
  return {
    source: target.sourceNodeId,
    sourceHandle: target.branch,
    rootPosition: sourcePosition ? getAppendedStepPosition(sourcePosition, legOffset, direction) : undefined,
  };
};

/** On a line: the step that followed goes after the piece's end, with every step after it. */
const reconnectFollowing = (
  next: TWorkflowDefinition,
  piece: TPiece,
  following: string,
  direction: TWorkflowCanvasDirection
): void => {
  const end = findOpenEnd(piece.nodes, piece.edges, piece.rootId);
  const endPosition = positionOf(next, end.nodeId);
  const followingPosition = positionOf(next, following);
  if (endPosition && followingPosition) {
    const after = getAppendedStepPosition(endPosition, end.branch ? 0 : null, direction);
    const pieceIds = new Set(piece.nodes.map((node) => node.id));
    const moving = new Set([...descendantsOf(next.edges, following)].filter((id) => !pieceIds.has(id)));
    moveBy(
      next.nodes.filter((node) => moving.has(node.id)),
      { x: after.x - followingPosition.x, y: after.y - followingPosition.y }
    );
  }
  next.edges.push({
    id: createId(),
    source: end.nodeId,
    target: following,
    ...(end.branch ? { sourceHandle: end.branch } : {}),
  });
};

/**
 * The definition with the clipboard pasted at `target`, or null when it can't go there. A cut moves
 * its steps; a copy adds fresh ones. Positions: the piece's first step lands where a new step at that
 * `+` would, the piece keeps its shape around it, and on a line the step that followed moves to just
 * after the piece's end, with everything after it.
 */
export const pasteSteps = ({
  definition,
  clipboard,
  target,
  direction,
  copyLabel,
}: {
  definition: TWorkflowDefinition;
  clipboard: TStepClipboard;
  target: TPasteTarget;
  direction: TWorkflowCanvasDirection;
  copyLabel: (node: TStepNode) => string;
}): TPasteResult | null => {
  if (!canPasteAt(definition, clipboard, target)) return null;
  const next = structuredClone(definition);
  const piece = takePiece(next, clipboard, copyLabel);
  const anchor = resolveAnchor(next, target, direction);
  if (!anchor) return null;

  const oldRootPosition = piece.nodes.find((node) => node.id === piece.rootId)?.ui?.position;
  if (anchor.rootPosition && oldRootPosition) {
    moveBy(piece.nodes, {
      x: anchor.rootPosition.x - oldRootPosition.x,
      y: anchor.rootPosition.y - oldRootPosition.y,
    });
  }
  next.edges.push({
    id: createId(),
    source: anchor.source,
    target: piece.rootId,
    ...(anchor.sourceHandle ? { sourceHandle: anchor.sourceHandle } : {}),
  });
  if (anchor.following) reconnectFollowing(next, piece, anchor.following, direction);

  return { definition: next, rootId: piece.rootId, stepCount: piece.nodes.length };
};

const STEP_REFERENCE = /steps\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_[\]-]+(?:\.[A-Za-z0-9_[\]-]+)*)/g;

/** A step reading another step's output (`steps.<sourceStepId>.<field>`). */
export type TStepReference = { readerId: string; sourceStepId: string; field: string };

/**
 * Every read of a step's output (`steps.<id>.…`) where that step doesn't run before the reader, e.g.
 * after a move: the checks before Enable flag the readers on their cards; the editor names them in its
 * warnings.
 */
export const findBrokenStepReferences = (definition: TWorkflowDefinition): TStepReference[] => {
  const parents = new Map<string, string[]>();
  for (const edge of definition.edges) {
    parents.set(edge.target, [...(parents.get(edge.target) ?? []), edge.source]);
  }
  const earlierSteps = (id: string): Set<string> => {
    const found = new Set<string>();
    const queue = [...(parents.get(id) ?? [])];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (found.has(current)) continue;
      found.add(current);
      queue.push(...(parents.get(current) ?? []));
    }
    return found;
  };
  return definition.nodes.flatMap((node) => {
    const reads = [...JSON.stringify(node.config).matchAll(STEP_REFERENCE)];
    if (reads.length === 0) return [];
    const earlier = earlierSteps(node.id);
    const broken = new Map<string, TStepReference>();
    for (const [, sourceStepId, field] of reads) {
      if (!earlier.has(sourceStepId)) {
        broken.set(`${sourceStepId}.${field}`, { readerId: node.id, sourceStepId, field });
      }
    }
    return [...broken.values()];
  });
};

/** The steps that read a step which no longer runs before them; counted for the warning after a paste. */
export const findStepsReadingUnreachableSteps = (definition: TWorkflowDefinition): string[] => [
  ...new Set(findBrokenStepReferences(definition).map((reference) => reference.readerId)),
];
