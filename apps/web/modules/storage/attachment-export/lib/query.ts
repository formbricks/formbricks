import { ATTACHMENT_EXPORT_TERMINAL_STATUSES, type TAttachmentExport } from "../types";

/** Typed query-key factory. Never inline string keys — the mutation targets these exact tuples. */
const attachmentExportKeyBase = ["attachment-exports"] as const;
export const attachmentExportKeys = {
  all: attachmentExportKeyBase,
  list: (surveyId: string) => [...attachmentExportKeyBase, "list", surveyId] as const,
};

export const ATTACHMENT_EXPORT_POLL_INTERVAL_MS = 5000;

export const isAttachmentExportActive = (attachmentExport: TAttachmentExport): boolean =>
  !ATTACHMENT_EXPORT_TERMINAL_STATUSES.has(attachmentExport.status);

/** Polls while any listed export is still building; a settled list is not asked again. */
export const getAttachmentExportsRefetchInterval = (
  exports: TAttachmentExport[] | undefined
): number | false => (exports?.some(isAttachmentExportActive) ? ATTACHMENT_EXPORT_POLL_INTERVAL_MS : false);

/**
 * The exports that settled between two polls: active in `previous`, terminal in `next`. These are the
 * ones the user is told about. An export first seen already settled (on page load) is not announced,
 * since it finished while nobody was watching and the menu lists it anyway.
 */
export const findNewlySettledExports = (
  previous: TAttachmentExport[] | undefined,
  next: TAttachmentExport[]
): TAttachmentExport[] => {
  if (!previous) return [];
  const wasActive = new Set(previous.filter(isAttachmentExportActive).map((item) => item.id));
  return next.filter((item) => wasActive.has(item.id) && !isAttachmentExportActive(item));
};

const BYTES_PER_MB = 1024 * 1024;
const BYTES_PER_GB = 1024 * BYTES_PER_MB;

/** "812 MB", "3.4 GB" — sizes the user compares against their connection, so one decimal is enough. */
export const formatArchiveSize = (bytes: number, locale: string): string => {
  const [value, unit] =
    bytes >= BYTES_PER_GB ? [bytes / BYTES_PER_GB, "gigabyte"] : [bytes / BYTES_PER_MB, "megabyte"];
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit,
    unitDisplay: "short",
    maximumFractionDigits: value < 10 ? 1 : 0,
  }).format(value);
};
