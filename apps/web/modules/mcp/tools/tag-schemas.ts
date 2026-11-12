import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZV3MergeTagBody, ZV3RenameTagBody } from "@/app/api/v3/tags/lib/schemas";

/**
 * Input schemas for the tag tools (outputs: `tag-output-schemas.ts`). Every input is `.strict()`, and the edit and merge inputs
 * take no workspace: the operation resolves it from the tag, so a caller cannot supply the scope it is
 * authorized against.
 */

export const ZMcpListTagsInput = z
  .object({ workspaceId: ZId.describe("Workspace whose tags to list.") })
  .strict();
export type TMcpListTagsInput = z.infer<typeof ZMcpListTagsInput>;

export const ZMcpUpdateTagInput = ZV3RenameTagBody.extend({
  tagId: ZId.describe("Tag to rename."),
  name: ZV3RenameTagBody.shape.name.describe(
    "The tag's new name. Must be unique in the workspace; a taken name is refused."
  ),
}).strict();
export type TMcpUpdateTagInput = z.infer<typeof ZMcpUpdateTagInput>;

export const ZMcpMergeTagsInput = ZV3MergeTagBody.extend({
  tagId: ZId.describe("Tag to merge away. It is removed once its responses carry the target tag."),
  newTagId: ZV3MergeTagBody.shape.newTagId.describe(
    "Tag to keep. Must be in the same workspace and differ from tagId."
  ),
}).strict();
export type TMcpMergeTagsInput = z.infer<typeof ZMcpMergeTagsInput>;
