import type { McpServer } from "@modelcontextprotocol/server";
import { problemForbidden } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { listV3Tags, mergeV3Tags, renameV3Tag } from "@/app/api/v3/tags/lib/operations";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import { responseToMcpToolResult } from "../errors";
import { runConfirmedDelete } from "./delete-confirmation";
import { registerMcpTool } from "./guard-permissions";
import { runMcpMutation } from "./run-mcp-mutation";
import { ZMcpTagListOutput, ZMcpTagMergeOutput, ZMcpTagOutput } from "./tag-output-schemas";
import {
  type TMcpListTagsInput,
  type TMcpMergeTagsInput,
  type TMcpUpdateTagInput,
  ZMcpListTagsInput,
  ZMcpMergeTagsInput,
  ZMcpUpdateTagInput,
} from "./tag-schemas";
import { DESTRUCTIVE_WRITE_ANNOTATIONS, READ_ANNOTATIONS, toolContext } from "./tool-context";

/**
 * MCP tools over the v3 Tags API: list, rename and merge. The Tags permission sits in the Responses
 * category and is capped by the `responses` scopes (ADR-0041), so it needed no new scope family.
 *
 * **No delete tool.** Deleting a tag is a hard delete, and agents get none. Merge also removes a tag, the
 * source one, but it moves every response onto the target first, so no tagging is lost: it fixes a
 * duplicate or a misspelling. That is the one allowed exception.
 *
 * **OAuth only.** `/api/v3/tags` is session-only, because tags were only ever managed by signed-in users
 * through server actions; an API key has never had tag access. An OAuth connection acts as its user, so
 * it gets these tools; an API key is refused here as it is over HTTP, so MCP does not widen what a key
 * can do.
 *
 * The operations resolve the workspace from the tag on rename and merge, and check that both tags of a
 * merge share it, so these tools take no workspace for a mutation.
 */

const API_KEY_REFUSAL =
  "Tags can only be managed by a signed-in user. Connect over OAuth; API keys have no tag access.";

/** The operation's answer, or the same 403 `/api/v3/tags` gives an API key. */
const asUser = (
  authentication: TV3Authentication,
  requestId: string,
  operation: () => Promise<Response>
): Promise<Response> =>
  authentication && "apiKeyId" in authentication
    ? Promise.resolve(problemForbidden(requestId, API_KEY_REFUSAL, MCP_API_ROUTE))
    : operation();

/** Runs the merge once the user agreed; `merge_tags` reaches it only through `runConfirmedDelete`. */
const mergeTags = (input: TMcpMergeTagsInput, ctx: Parameters<typeof runMcpMutation>[0]) =>
  runMcpMutation(
    ctx,
    {
      action: "merged",
      resource: "tag",
      logContext: { tagId: input.tagId, newTagId: input.newTagId },
    },
    ({ authentication, requestId, auditLog }) =>
      asUser(authentication, requestId, () =>
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

export function registerTagTools(server: McpServer): void {
  registerMcpTool(
    server,
    "list_tags",
    {
      title: "List tags",
      description:
        "List a workspace's response tags, each with the number of responses carrying it that you may read.",
      inputSchema: ZMcpListTagsInput,
      outputSchema: ZMcpTagListOutput,
      annotations: READ_ANNOTATIONS,
    },
    [{ permission: "tags", level: "read" }],
    async (input: TMcpListTagsInput, ctx) => {
      const context = toolContext(ctx);
      const response = await asUser(context.authentication, context.requestId, () =>
        listV3Tags({ workspaceId: input.workspaceId, ...context })
      );

      return await responseToMcpToolResult(response, context.requestId);
    }
  );

  registerMcpTool(
    server,
    "update_tag",
    {
      title: "Rename tag",
      description:
        "Rename a response tag. The name must be unique in its workspace. To fold a duplicate into another tag, use merge_tags.",
      inputSchema: ZMcpUpdateTagInput,
      outputSchema: ZMcpTagOutput,
      audit: { action: "updated", targetType: "tag", targetIdArg: "tagId" },
      annotations: DESTRUCTIVE_WRITE_ANNOTATIONS,
    },
    [{ permission: "tags", level: "write" }],
    async (input: TMcpUpdateTagInput, ctx) =>
      runMcpMutation(
        ctx,
        { action: "updated", resource: "tag", logContext: { tagId: input.tagId } },
        ({ authentication, requestId, auditLog }) =>
          asUser(authentication, requestId, () =>
            renameV3Tag({
              tagId: input.tagId,
              name: input.name,
              authentication,
              requestId,
              instance: MCP_API_ROUTE,
              auditLog,
            })
          )
      )
  );

  registerMcpTool(
    server,
    "merge_tags",
    {
      title: "Merge tags",
      description: [
        "Move every response tagged tagId onto newTagId, then remove tagId. Both tags must be in the same",
        "workspace. Use it to fold a duplicate or misspelled tag into the right one; it cannot be undone, so the user",
        "is asked to confirm first.",
      ].join(" "),
      inputSchema: ZMcpMergeTagsInput,
      outputSchema: ZMcpTagMergeOutput,
      audit: { action: "merged", targetType: "tag", targetIdArg: "tagId" },
      annotations: DESTRUCTIVE_WRITE_ANNOTATIONS,
    },
    [{ permission: "tags", level: "write" }],
    // Removes tagId for good, so it confirms first like the delete tools (finding 07): a merge asked for by
    // text inside a tool result must not happen without the user agreeing.
    async (input: TMcpMergeTagsInput, ctx) => {
      // An API key can never merge, so it gets the 403 now rather than a prompt it cannot use.
      const { authentication, requestId } = toolContext(ctx);
      if (authentication && "apiKeyId" in authentication) {
        return await responseToMcpToolResult(
          problemForbidden(requestId, API_KEY_REFUSAL, MCP_API_ROUTE),
          requestId
        );
      }

      return await runConfirmedDelete({
        tool: "merge_tags",
        resourceKey: `${input.tagId}->${input.newTagId}`,
        prompt: `Merge tag ${input.tagId} into ${input.newTagId}? Tag ${input.tagId} is removed and this cannot be undone.`,
        confirm: input.confirm,
        ctx,
        run: () => mergeTags(input, ctx),
      });
    }
  );
}
