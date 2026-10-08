import { z } from "zod";

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

/**
 * `POST /api/internal/surveys/import/stream`. The browser parses the .qsf and sends it as an object,
 * not a string, so nothing is escaped twice (ENG-3604).
 *
 * `qsf` is checked only for being a JSON object here. A `z.record` would copy the whole body, key by
 * key, into a fresh object — for a 15 MB file, for nothing, and through ordinary assignment, which is
 * how a `__proto__` key turns into prototype pollution. The reader owns the file's structure.
 */
export const ZQsfImportStreamBody = z.strictObject({
  workspaceId: z.cuid2(),
  fileName: z.string().trim().min(1).max(255),
  qsf: z.custom<Record<string, unknown>>(isPlainObject, { message: "qsf must be a JSON object" }),
});

export type TQsfImportStreamBody = z.infer<typeof ZQsfImportStreamBody>;
