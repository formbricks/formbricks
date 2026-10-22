/**
 * What each Creatives access level allows (ENG-6602). `getCreativesAccess` (`access.ts`, server only)
 * decides the level; these rules are pure so the API v3 routes, the MCP tools and the client UI all read
 * the same definition.
 *
 * - `full`: the instance's licence includes Creatives. Everything is allowed.
 * - `windDown`: self-hosted, the licence doesn't include Creatives, and the workspace still has creatives.
 *   They are read-only and hidden from sites; authors may still take them down (pause, close, delete).
 * - `none`: Creatives doesn't exist for the workspace (Cloud, or nothing to wind down). Every surface is
 *   hidden or answers 403/404.
 */
export type TCreativesAccess = "full" | "windDown" | "none";

/**
 * Everything a surface can do to creatives. A PATCH is `pause`, `close` or `update` depending on its
 * body; `getCreativePatchOperation` tells which.
 */
export type TCreativesOperation =
  | "list"
  | "get"
  | "stats"
  | "create"
  | "update"
  | "pause"
  | "close"
  | "delete"
  | "archive"
  | "restore"
  | "duplicate";

/**
 * Reading creatives and taking them down. Creating, editing, duplicating, resuming, reopening,
 * publishing, archiving and restoring all need `full`.
 */
export const CREATIVES_WIND_DOWN_OPERATIONS: readonly TCreativesOperation[] = [
  "list",
  "get",
  "stats",
  "pause",
  "close",
  "delete",
];

export const isCreativesOperationAllowed = (
  access: TCreativesAccess,
  operation: TCreativesOperation
): boolean => {
  if (access === "full") return true;
  if (access === "windDown") return CREATIVES_WIND_DOWN_OPERATIONS.includes(operation);
  return false;
};

/**
 * The sidebar entry, the Creatives pages and the survey-side creative UI ("Opened by", the creatives
 * listed in survey dialogs) show. In wind-down they show read-only, so authors can act on what is linked.
 */
export const isCreativesVisible = (access: TCreativesAccess): boolean => access !== "none";

/** Anything beyond the wind-down operations: new creative, editor, duplicate, resume, publish, archive. */
export const canWriteCreatives = (access: TCreativesAccess): boolean => access === "full";

/**
 * The operation a creative PATCH body performs: `pause` or `close` when it sets `status` to `paused` or
 * `completed` and nothing else, `update` for anything else, an empty body included. Keys whose value is
 * `undefined` don't count, as they change nothing.
 */
export const getCreativePatchOperation = (
  body: Readonly<Record<string, unknown>>
): Extract<TCreativesOperation, "pause" | "close" | "update"> => {
  const setKeys = Object.keys(body).filter((key) => body[key] !== undefined);
  if (setKeys.length !== 1 || setKeys[0] !== "status") return "update";
  if (body.status === "paused") return "pause";
  if (body.status === "completed") return "close";
  return "update";
};
