import {
  IMPORT_LANE_BY_KIND,
  type TImportLane,
  type TImportLaneHandler,
  type TImportSourceKind,
} from "../types";
import { documentLane } from "./document";
import { formbricksLane } from "./formbricks";
import { qsfLane } from "./qsf";

/**
 * Lane registry. A kind without a handler is a lane that has not shipped yet; the convert route
 * answers `lane_not_available` for it instead of guessing.
 */
const LANE_HANDLERS: Partial<Record<TImportLane, TImportLaneHandler>> = {
  lossless: formbricksLane,
  structured: qsfLane,
  ai: documentLane,
};

export function getImportLaneHandler(kind: TImportSourceKind): TImportLaneHandler | null {
  return LANE_HANDLERS[IMPORT_LANE_BY_KIND[kind]] ?? null;
}

/** Test seam: swap a lane handler for a stub. */
export function registerImportLane(lane: TImportLane, handler: TImportLaneHandler): void {
  LANE_HANDLERS[lane] = handler;
}
