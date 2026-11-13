import { z } from "zod";
import { ZId } from "@formbricks/types/common";

/**
 * Request strings are bounded like every other request string (ENG-1652). Far above anything real: a
 * language code is a BCP-47 tag, and an alias is a short identifier the survey link carries.
 */
const LANGUAGE_FIELD_MAX_LENGTH = 255;

const ZLanguageAlias = z.string().max(LANGUAGE_FIELD_MAX_LENGTH).nullable();

export const ZLanguageWorkspaceQuery = z.object({ workspaceId: ZId }).strict();

export const ZLanguageIdParams = z.object({ languageId: ZId }).strict();

/**
 * `POST /api/internal/languages?workspaceId=` body. Which codes are supported, and their canonical form,
 * are the language service's rules: it refuses anything outside the curated catalog.
 */
export const ZLanguageCreateBody = z
  .object({
    code: z.string().min(1).max(LANGUAGE_FIELD_MAX_LENGTH),
    alias: ZLanguageAlias,
  })
  .strict();

/**
 * `PATCH /api/internal/languages/{languageId}` body. Alias only: a language's code is immutable, so a
 * code change is a delete and a create, and a body naming one is refused rather than silently dropped.
 */
export const ZLanguageUpdateBody = z.object({ alias: ZLanguageAlias }).strict();

export type TLanguageCreateBody = z.infer<typeof ZLanguageCreateBody>;
export type TLanguageUpdateBody = z.infer<typeof ZLanguageUpdateBody>;
