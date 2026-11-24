import { z } from "zod";
import { ZId } from "@formbricks/types/common";

/** Longest tag name a create may set, the same cap a rename has (`ZV3RenameTagBody`). */
export const TAG_NAME_MAX_LENGTH = 255;

/**
 * `POST /api/internal/tags` body: a new tag in a workspace. The name is kept as typed, as the server action
 * kept it, but bounded, and refuses the NUL character Postgres can't store.
 */
export const ZCreateTagBody = z
  .object({
    workspaceId: ZId,
    name: z
      .string()
      .max(TAG_NAME_MAX_LENGTH)
      .refine((name) => !name.includes("\u0000"), { error: "Tag name must not contain NUL characters" }),
  })
  .strict();

export type TCreateTagBody = z.infer<typeof ZCreateTagBody>;
