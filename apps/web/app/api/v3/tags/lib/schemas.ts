import { z } from "zod";

export const ZV3TagIdParams = z.object({ tagId: z.cuid2() }).strict();

export const ZV3TagListQuery = z.object({ workspaceId: z.cuid2() }).strict();

/**
 * The old `updateTagNameAction` accepted a bare `z.string()` and the component trimmed before calling.
 * Trimming and rejecting empty here instead means a blank rename is a 422 rather than a tag silently
 * named "".
 */
export const ZV3RenameTagBody = z.object({ name: z.string().trim().min(1).max(255) }).strict();

export const ZV3MergeTagBody = z.object({ newTagId: z.cuid2() }).strict();

export type TV3TagIdParams = z.infer<typeof ZV3TagIdParams>;
export type TV3TagListQuery = z.infer<typeof ZV3TagListQuery>;
