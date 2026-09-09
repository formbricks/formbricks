import { importInfo } from "../report";
import type { TImportIssue } from "../types";
import { isRecord } from "./paths";

/**
 * Targeting (segment filters) is out of v1: the export never carries it, and a hand-crafted document
 * loses it here. An empty filter list means "everyone", which is also the default, so only a
 * non-empty one is worth a line in the report.
 */
export function resolveImportTargeting(document: Record<string, unknown>): TImportIssue[] {
  if (!("targeting" in document)) return [];

  const targeting = document.targeting;
  const hadFilters = isRecord(targeting) && Array.isArray(targeting.filters) && targeting.filters.length > 0;
  delete document.targeting;

  return hadFilters ? [importInfo({ code: "targeting_not_imported", path: "targeting" })] : [];
}
