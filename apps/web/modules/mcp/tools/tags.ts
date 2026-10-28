import type { McpServer } from "@modelcontextprotocol/server";
import { deleteV3Tag, listV3Tags, mergeV3Tags, renameV3Tag } from "@/app/api/v3/tags/lib/operations";
import { ZV3TagIdResource, ZV3TagResource } from "@/app/api/v3/tags/lib/schemas";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import { getMcpAuthentication, getMcpRequestId, getMcpToolAuthInfo } from "../auth";
import { responseToMcpToolResult } from "../errors";
import { registerScopedTool } from "./guard-scopes";
import { mcpToolOutput } from "./output-schemas";
import { runMcpMutation } from "./run-mcp-mutation";
import {
  type TMcpDeleteTagInput,
  type TMcpListTagsInput,
  type TMcpMergeTagsInput,
  type TMcpRenameTagInput,
  ZMcpDeleteTagInput,
  ZMcpListTagsInput,
  ZMcpMergeTagsInput,
  ZMcpRenameTagInput,
} from "./tag-schemas";

const ZMcpTagListOutput = mcpToolOutput(ZV3TagResource.array());
const ZMcpTagOutput = mcpToolOutput(ZV3TagResource);
const ZMcpTagIdOutput = mcpToolOutput(ZV3TagIdResource);

/**
 * Response tags. They label responses, so they ride on the survey scopes rather than a family of
 * their own (agent-first scope model, ADR 0015). The scope is the first gate; the operation still
 * resolves the workspace from the tag and requires write access to it.
 */
export function registerTagTools(server: McpServer): void {
  registerScopedTool(
    server,
    "list_tags",
    {
      title: "List tags",
      description:
        "List a workspace's response tags, each with the number of responses currently carrying it.",
      inputSchema: ZMcpListTagsInput,
      outputSchema: ZMcpTagListOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    ["surveys:read"],
    async (input: TMcpListTagsInput, ctx) => {
      const authInfo = getMcpToolAuthInfo(ctx);
      const requestId = getMcpRequestId(authInfo);
      const response = await listV3Tags({
        workspaceId: input.workspaceId,
        authentication: getMcpAuthentication(authInfo),
        requestId,
        instance: MCP_API_ROUTE,
      });

      return await responseToMcpToolResult(response, requestId);
    }
  );

  registerScopedTool(
    server,
    "rename_tag",
    {
      title: "Rename tag",
      description:
        "Rename a response tag. A name already used by another tag in the workspace is rejected with a 422.",
      inputSchema: ZMcpRenameTagInput,
      outputSchema: ZMcpTagOutput,
      audit: { action: "updated", targetType: "tag", targetIdArg: "tagId" },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    ["surveys:write"],
    async (input: TMcpRenameTagInput, ctx) =>
      runMcpMutation(
        ctx,
        { action: "updated", resource: "tag", logContext: { tagId: input.tagId } },
        ({ authentication, requestId, auditLog }) =>
          renameV3Tag({
            tagId: input.tagId,
            name: input.name,
            authentication,
            requestId,
            instance: MCP_API_ROUTE,
            auditLog,
          })
      )
  );

  registerScopedTool(
    server,
    "delete_tag",
    {
      title: "Delete tag",
      description:
        "Delete a response tag and remove it from every response carrying it. To keep the responses labelled, use merge_tags instead.",
      inputSchema: ZMcpDeleteTagInput,
      outputSchema: ZMcpTagIdOutput,
      audit: { action: "deleted", targetType: "tag", targetIdArg: "tagId" },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    ["surveys:write"],
    async (input: TMcpDeleteTagInput, ctx) =>
      runMcpMutation(
        ctx,
        { action: "deleted", resource: "tag", logContext: { tagId: input.tagId } },
        ({ authentication, requestId, auditLog }) =>
          deleteV3Tag({
            tagId: input.tagId,
            authentication,
            requestId,
            instance: MCP_API_ROUTE,
            auditLog,
          })
      )
  );

  registerScopedTool(
    server,
    "merge_tags",
    {
      title: "Merge tags",
      description:
        "Move every response tagged `tagId` onto `newTagId`, then delete `tagId`. Both tags must be in the same workspace. Returns the id of the surviving tag.",
      inputSchema: ZMcpMergeTagsInput,
      outputSchema: ZMcpTagIdOutput,
      audit: { action: "merged", targetType: "tag", targetIdArg: "tagId" },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    ["surveys:write"],
    async (input: TMcpMergeTagsInput, ctx) =>
      runMcpMutation(
        ctx,
        { action: "merged", resource: "tag", logContext: { tagId: input.tagId } },
        ({ authentication, requestId, auditLog }) =>
          mergeV3Tags({
            tagId: input.tagId,
            newTagId: input.newTagId,
            authentication,
            requestId,
            instance: MCP_API_ROUTE,
            auditLog,
          })
      )
  );
}
