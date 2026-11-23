/**
 * Client-safe constants of Dashboard Viewer access (ADR-0060): which fields a condition may name, and how
 * many conditions a dataset holds. The claim (`viewer-access-claim.ts`) and the settings UI share them.
 */

/** At most this many conditions on one dataset. Mirrored in docker/cube/cube.js. */
export const VIEWER_ACCESS_MAX_CONDITIONS = 10;
/** A condition on an embedded-data key names its field `ed:<key>`. */
export const VIEWER_ACCESS_EMBEDDED_PREFIX = "ed:";

/**
 * The Feedback Record's own string fields a condition may name: fields of the record itself (where it
 * came from and its response context), never the answer it holds, and each one Cube matches ignoring case
 * and surrounding spaces. Mirrored in docker/cube/cube.js (`VIEWER_ACCESS_MEMBERS`).
 */
export const VIEWER_ACCESS_RECORD_FIELDS: Readonly<Record<string, string>> = {
  "FeedbackRecords.sourceName": "Source Name",
  "FeedbackRecords.sourceType": "Source Type",
  "FeedbackRecords.metadataCountry": "Country",
  "FeedbackRecords.metadataSource": "Channel",
  "FeedbackRecords.metadataDevice": "Device",
  "FeedbackRecords.metadataBrowser": "Browser",
  "FeedbackRecords.metadataOs": "Operating System",
  "FeedbackRecords.metadataAction": "Trigger Action",
  "FeedbackRecords.language": "Language",
};

export type TViewerAccessJoin = "all" | "any";

/** The embedded-data key a condition field names, or `null` for a record field. */
export const getViewerAccessEmbeddedKey = (field: string): string | null =>
  field.startsWith(VIEWER_ACCESS_EMBEDDED_PREFIX) ? field.slice(VIEWER_ACCESS_EMBEDDED_PREFIX.length) : null;
