import {
  IMPORT_LANE_BY_KIND,
  type TImportLane,
  type TImportLaneHandler,
  type TImportSourceKind,
} from "../types";
import { formbricksLane } from "./formbricks";

/**
 * Lane registry. A kind without a handler is a lane that has not shipped yet; the convert route
 * answers `lane_not_available` for it instead of guessing.
 */
const LANE_HANDLERS: Partial<Record<TImportLane, TImportLaneHandler>> = {
  lossless: formbricksLane,
};

export function getImportLaneHandler(kind: TImportSourceKind): TImportLaneHandler | null {
  return LANE_HANDLERS[IMPORT_LANE_BY_KIND[kind]] ?? null;
}

/** Test seam and future registration point for the structured and AI lanes. */
export function registerImportLane(lane: TImportLane, handler: TImportLaneHandler): void {
  LANE_HANDLERS[lane] = handler;
}
