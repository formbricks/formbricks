import { z } from "zod";
import { ZV3MergeTagBody, ZV3RenameTagBody, ZV3TagIdParams } from "@/app/api/v3/tags/lib/schemas";

export const ZMcpListTagsInput = z
  .object({
    workspaceId: z.cuid2().describe("Workspace ID whose response tags should be listed."),
  })
  .strict();

const tagIdField = z.cuid2().describe("Tag ID. Use list_tags to discover ids.");

export const ZMcpRenameTagInput = ZV3TagIdParams.extend({
  tagId: tagIdField,
  name: ZV3RenameTagBody.shape.name.describe("The new tag name. Must be unique within the workspace."),
}).strict();

export const ZMcpDeleteTagInput = ZV3TagIdParams.extend({ tagId: tagIdField }).strict();

export const ZMcpMergeTagsInput = ZV3TagIdParams.extend({
  tagId: tagIdField.describe("The tag to merge away. It is deleted once its responses have moved."),
  newTagId: ZV3MergeTagBody.shape.newTagId.describe("The tag that keeps the responses. Same workspace."),
}).strict();

export type TMcpListTagsInput = z.infer<typeof ZMcpListTagsInput>;
export type TMcpRenameTagInput = z.infer<typeof ZMcpRenameTagInput>;
export type TMcpDeleteTagInput = z.infer<typeof ZMcpDeleteTagInput>;
export type TMcpMergeTagsInput = z.infer<typeof ZMcpMergeTagsInput>;
