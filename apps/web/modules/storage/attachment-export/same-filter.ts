import type { TResponseFilterCriteria } from "@formbricks/types/responses";

/** JSON with every object's keys sorted, so two equal filters compare equal whatever their key order. */
const toCanonicalJson = (value: unknown): string =>
  JSON.stringify(value, (_key, nested: unknown) =>
    nested && typeof nested === "object" && !Array.isArray(nested)
      ? Object.fromEntries(Object.entries(nested).sort(([a], [b]) => a.localeCompare(b)))
      : nested
  );

/**
 * Whether an export in flight was started with the filter a new request asks for. One export runs per
 * requester and survey, so a request with a different filter must not be handed the running one: its
 * archive would hold other responses than the ones asked for. The stored filter went through JSON, so
 * both are compared as JSON (dates as ISO strings).
 */
export const isSameAttachmentExportFilter = (
  stored: unknown,
  requested: TResponseFilterCriteria | undefined
): boolean => toCanonicalJson(stored ?? null) === toCanonicalJson(requested ?? null);
