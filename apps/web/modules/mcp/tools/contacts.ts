import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { ZV3ContactAttributeKeyResource } from "@/app/api/v3/contact-attribute-keys/schemas";
import {
  createV3ContactAttributeKey,
  deleteV3ContactAttributeKey,
  updateV3ContactAttributeKey,
} from "@/app/api/v3/contacts/lib/attribute-key-operations";
import {
  countV3Contacts,
  deleteV3Contact,
  getV3Contact,
  listV3Contacts,
  updateV3Contact,
  upsertV3Contact,
} from "@/app/api/v3/contacts/lib/operations";
import {
  ZV3ContactCountResource,
  ZV3ContactResource,
  ZV3IdResource,
} from "@/app/api/v3/contacts/lib/schemas";
import {
  createV3SegmentFromRawInput,
  deleteV3Segment,
  getV3Segment,
  listV3Segments,
  updateV3SegmentFromRawInput,
} from "@/app/api/v3/segments/lib/operations";
import { ZV3SegmentListItem, ZV3SegmentResource } from "@/app/api/v3/segments/lib/schemas";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import { type TMcpToolContext, getMcpAuthentication, getMcpRequestId, getMcpToolAuthInfo } from "../auth";
import { responseToMcpToolResult } from "../errors";
import {
  type TMcpCountContactsInput,
  type TMcpCreateContactAttributeKeyInput,
  type TMcpCreateSegmentInput,
  type TMcpDeleteContactAttributeKeyInput,
  type TMcpDeleteContactInput,
  type TMcpDeleteSegmentInput,
  type TMcpGetContactInput,
  type TMcpGetSegmentInput,
  type TMcpListContactsInput,
  type TMcpListSegmentsInput,
  type TMcpUpdateContactAttributeKeyInput,
  type TMcpUpdateContactInput,
  type TMcpUpdateSegmentInput,
  type TMcpUpsertContactInput,
  ZMcpCountContactsInput,
  ZMcpCreateContactAttributeKeyInput,
  ZMcpCreateSegmentInput,
  ZMcpDeleteContactAttributeKeyInput,
  ZMcpDeleteContactInput,
  ZMcpDeleteSegmentInput,
  ZMcpGetContactInput,
  ZMcpGetSegmentInput,
  ZMcpListContactsInput,
  ZMcpListSegmentsInput,
  ZMcpUpdateContactAttributeKeyInput,
  ZMcpUpdateContactInput,
  ZMcpUpdateSegmentInput,
  ZMcpUpsertContactInput,
} from "./contact-schemas";
import { registerScopedTool } from "./guard-scopes";
import { mcpToolOutput } from "./output-schemas";
import { runMcpMutation } from "./run-mcp-mutation";

/**
 * These collections page with `limit` and `nextCursor` only: no totals, because `count_contacts` is the
 * cheap way to ask "how many", so the shared four-key list meta does not describe them.
 */
const ZMcpCursorMeta = z.object({ limit: z.number().int(), nextCursor: z.string().nullable() }).strict();

const listOutput = <TData extends z.ZodType>(item: TData) =>
  mcpToolOutput(z.array(item)).extend({ meta: ZMcpCursorMeta.optional() }).strict();

/** A contact write can succeed while skipping part of what was asked; the skipped parts are `warnings`. */
const writeOutput = <TData extends z.ZodType>(data: TData) =>
  mcpToolOutput(data)
    .extend({ warnings: z.array(z.string()).optional() })
    .strict();

const ZMcpContactListOutput = listOutput(ZV3ContactResource);
const ZMcpContactCountOutput = mcpToolOutput(ZV3ContactCountResource);
const ZMcpContactOutput = mcpToolOutput(ZV3ContactResource);
const ZMcpContactWriteOutput = writeOutput(ZV3ContactResource);
const ZMcpIdOutput = mcpToolOutput(ZV3IdResource);
const ZMcpAttributeKeyOutput = mcpToolOutput(ZV3ContactAttributeKeyResource);
const ZMcpSegmentListOutput = listOutput(ZV3SegmentListItem);
const ZMcpSegmentOutput = mcpToolOutput(ZV3SegmentResource);

const READ_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

/** The context every tool derives the same way, so no tool invents its own request id. */
const toolContext = (ctx: TMcpToolContext) => {
  const authInfo = getMcpToolAuthInfo(ctx);
  const requestId = getMcpRequestId(authInfo);

  return { authentication: getMcpAuthentication(authInfo), requestId, instance: MCP_API_ROUTE };
};

/**
 * Contacts, their attribute keys and segments, on `contacts:read` / `contacts:write`.
 *
 * Every tool is one v3 operation, so the scope is the first gate and the operation still resolves the
 * workspace, checks the caller's access to it and answers the Enterprise entitlement refusal. Contacts
 * are respondent personal data: no tool takes a tenant id it does not authorize, and a contact or segment
 * id from another workspace answers the same 403 as an unknown one.
 */
export function registerContactTools(server: McpServer): void {
  registerContactReadTools(server);
  registerContactWriteTools(server);
  registerAttributeKeyTools(server);
  registerSegmentTools(server);
}

function registerContactReadTools(server: McpServer): void {
  registerScopedTool(
    server,
    "list_contacts",
    {
      title: "List contacts",
      description:
        "List a workspace's contacts (respondents) with all their attributes, newest first. Filter by userId, or by one exact attribute value. Contacts are personal data: ask for the narrowest filter that answers the question.",
      inputSchema: ZMcpListContactsInput,
      outputSchema: ZMcpContactListOutput,
      annotations: READ_ANNOTATIONS,
    },
    ["contacts:read"],
    async (input: TMcpListContactsInput, ctx) => {
      const context = toolContext(ctx);
      const response = await listV3Contacts({ query: input, ...context });
      return await responseToMcpToolResult(response, context.requestId);
    }
  );

  registerScopedTool(
    server,
    "count_contacts",
    {
      title: "Count contacts",
      description:
        "Count the contacts matching the same filters as list_contacts, without fetching them. Prefer this over listing a page and counting it.",
      inputSchema: ZMcpCountContactsInput,
      outputSchema: ZMcpContactCountOutput,
      annotations: READ_ANNOTATIONS,
    },
    ["contacts:read"],
    async (input: TMcpCountContactsInput, ctx) => {
      const context = toolContext(ctx);
      const response = await countV3Contacts({ query: input, ...context });
      return await responseToMcpToolResult(response, context.requestId);
    }
  );

  registerScopedTool(
    server,
    "get_contact",
    {
      title: "Get contact",
      description: "Read one contact with all its attributes.",
      inputSchema: ZMcpGetContactInput,
      outputSchema: ZMcpContactOutput,
      annotations: READ_ANNOTATIONS,
    },
    ["contacts:read"],
    async (input: TMcpGetContactInput, ctx) => {
      const context = toolContext(ctx);
      const response = await getV3Contact({ contactId: input.contactId, ...context });
      return await responseToMcpToolResult(response, context.requestId);
    }
  );
}

function registerContactWriteTools(server: McpServer): void {
  registerScopedTool(
    server,
    "upsert_contact",
    {
      title: "Create or update contact",
      description:
        "Create the contact for a userId, or update it when one already exists, optionally setting attributes. The same identify the SDK performs. Returns the contact; attributes that were skipped (a duplicate email, a wrong type) are listed in warnings.",
      inputSchema: ZMcpUpsertContactInput,
      outputSchema: ZMcpContactWriteOutput,
      audit: { action: "createdUpdated", targetType: "contact" },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    ["contacts:write"],
    async (input: TMcpUpsertContactInput, ctx) =>
      runMcpMutation(
        ctx,
        { action: "createdUpdated", resource: "contact" },
        ({ authentication, requestId, auditLog }) =>
          upsertV3Contact({ body: input, authentication, requestId, instance: MCP_API_ROUTE, auditLog })
      )
  );

  registerScopedTool(
    server,
    "update_contact",
    {
      title: "Update contact",
      description:
        "Set attributes on a contact (merged, so omitted attributes stay) and/or remove attribute keys from it. Use this for a contact without a userId; otherwise upsert_contact.",
      inputSchema: ZMcpUpdateContactInput,
      outputSchema: ZMcpContactWriteOutput,
      audit: { action: "updated", targetType: "contact", targetIdArg: "contactId" },
      // Removing an attribute discards its value, and the result does not carry the old one.
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    ["contacts:write"],
    async (input: TMcpUpdateContactInput, ctx) =>
      runMcpMutation(
        ctx,
        { action: "updated", resource: "contact", logContext: { contactId: input.contactId } },
        ({ authentication, requestId, auditLog }) =>
          updateV3Contact({
            contactId: input.contactId,
            body: { attributes: input.attributes, removeAttributeKeys: input.removeAttributeKeys },
            authentication,
            requestId,
            instance: MCP_API_ROUTE,
            auditLog,
          })
      )
  );

  registerScopedTool(
    server,
    "delete_contact",
    {
      title: "Delete contact",
      description:
        "Permanently delete a contact together with their responses and displays. This cannot be undone: pass confirm: true only after the user has agreed.",
      inputSchema: ZMcpDeleteContactInput,
      outputSchema: ZMcpIdOutput,
      audit: { action: "deleted", targetType: "contact", targetIdArg: "contactId" },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    ["contacts:write"],
    async (input: TMcpDeleteContactInput, ctx) =>
      runMcpMutation(
        ctx,
        { action: "deleted", resource: "contact", logContext: { contactId: input.contactId } },
        ({ authentication, requestId, auditLog }) =>
          deleteV3Contact({
            contactId: input.contactId,
            authentication,
            requestId,
            instance: MCP_API_ROUTE,
            auditLog,
          })
      )
  );
}

/** Reading attribute keys is `list_contact_attribute_keys`; these are its write side. */
function registerAttributeKeyTools(server: McpServer): void {
  registerScopedTool(
    server,
    "create_contact_attribute_key",
    {
      title: "Create contact attribute key",
      description:
        "Define a custom contact attribute key, with a data type (string, number or date) that segment filters use to pick operators. Setting an attribute on a contact also creates its key, typed from the first value; use this to fix the type up front.",
      inputSchema: ZMcpCreateContactAttributeKeyInput,
      outputSchema: ZMcpAttributeKeyOutput,
      audit: { action: "created", targetType: "contactAttributeKey" },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    ["contacts:write"],
    async (input: TMcpCreateContactAttributeKeyInput, ctx) =>
      runMcpMutation(
        ctx,
        { action: "created", resource: "contactAttributeKey" },
        ({ authentication, requestId, auditLog }) =>
          createV3ContactAttributeKey({
            body: input,
            authentication,
            requestId,
            instance: MCP_API_ROUTE,
            auditLog,
          })
      )
  );

  registerScopedTool(
    server,
    "update_contact_attribute_key",
    {
      title: "Update contact attribute key",
      description:
        "Change a custom attribute key's display name or description. The key itself and its type cannot change. Default keys are refused.",
      inputSchema: ZMcpUpdateContactAttributeKeyInput,
      outputSchema: ZMcpAttributeKeyOutput,
      audit: { action: "updated", targetType: "contactAttributeKey", targetIdArg: "attributeKeyId" },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    ["contacts:write"],
    async (input: TMcpUpdateContactAttributeKeyInput, ctx) =>
      runMcpMutation(
        ctx,
        {
          action: "updated",
          resource: "contactAttributeKey",
          logContext: { attributeKeyId: input.attributeKeyId },
        },
        ({ authentication, requestId, auditLog }) =>
          updateV3ContactAttributeKey({
            attributeKeyId: input.attributeKeyId,
            body: { name: input.name, description: input.description },
            authentication,
            requestId,
            instance: MCP_API_ROUTE,
            auditLog,
          })
      )
  );

  registerScopedTool(
    server,
    "delete_contact_attribute_key",
    {
      title: "Delete contact attribute key",
      description:
        "Delete a custom attribute key and every contact's value for it. Segment filters that use it stop matching. This cannot be undone: pass confirm: true only after the user has agreed. Default keys are refused.",
      inputSchema: ZMcpDeleteContactAttributeKeyInput,
      outputSchema: ZMcpIdOutput,
      audit: { action: "deleted", targetType: "contactAttributeKey", targetIdArg: "attributeKeyId" },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    ["contacts:write"],
    async (input: TMcpDeleteContactAttributeKeyInput, ctx) =>
      runMcpMutation(
        ctx,
        {
          action: "deleted",
          resource: "contactAttributeKey",
          logContext: { attributeKeyId: input.attributeKeyId },
        },
        ({ authentication, requestId, auditLog }) =>
          deleteV3ContactAttributeKey({
            attributeKeyId: input.attributeKeyId,
            authentication,
            requestId,
            instance: MCP_API_ROUTE,
            auditLog,
          })
      )
  );
}

function registerSegmentTools(server: McpServer): void {
  registerScopedTool(
    server,
    "list_segments",
    {
      title: "List segments",
      description:
        "List a workspace's reusable contact segments: id, title and description. Read one with get_segment for its filters and the surveys using it. A survey's own targeting is not listed here.",
      inputSchema: ZMcpListSegmentsInput,
      outputSchema: ZMcpSegmentListOutput,
      annotations: READ_ANNOTATIONS,
    },
    ["contacts:read"],
    async (input: TMcpListSegmentsInput, ctx) => {
      const context = toolContext(ctx);
      const response = await listV3Segments({ query: input, ...context });
      return await responseToMcpToolResult(response, context.requestId);
    }
  );

  registerScopedTool(
    server,
    "get_segment",
    {
      title: "Get segment",
      description: "Read one segment with its filter tree and the surveys that use it.",
      inputSchema: ZMcpGetSegmentInput,
      outputSchema: ZMcpSegmentOutput,
      annotations: READ_ANNOTATIONS,
    },
    ["contacts:read"],
    async (input: TMcpGetSegmentInput, ctx) => {
      const context = toolContext(ctx);
      const response = await getV3Segment({ segmentId: input.segmentId, ...context });
      return await responseToMcpToolResult(response, context.requestId);
    }
  );

  registerScopedTool(
    server,
    "create_segment",
    {
      title: "Create segment",
      description:
        "Create a reusable contact segment from a filter tree. Filters that point at an unknown attribute key, segment or survey are rejected with the node named.",
      inputSchema: ZMcpCreateSegmentInput,
      outputSchema: ZMcpSegmentOutput,
      audit: { action: "created", targetType: "segment" },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    ["contacts:write"],
    async (input: TMcpCreateSegmentInput, ctx) =>
      runMcpMutation(
        ctx,
        { action: "created", resource: "segment" },
        ({ authentication, requestId, auditLog }) =>
          createV3SegmentFromRawInput({
            body: input,
            authentication,
            requestId,
            instance: MCP_API_ROUTE,
            auditLog,
          })
      )
  );

  registerScopedTool(
    server,
    "update_segment",
    {
      title: "Update segment",
      description:
        "Change a segment's title, description or filters. Filters, when given, replace the whole tree. Surveys already using the segment pick up the change.",
      inputSchema: ZMcpUpdateSegmentInput,
      outputSchema: ZMcpSegmentOutput,
      audit: { action: "updated", targetType: "segment", targetIdArg: "segmentId" },
      // A replaced tree is not recoverable from the result.
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    ["contacts:write"],
    async (input: TMcpUpdateSegmentInput, ctx) =>
      runMcpMutation(
        ctx,
        { action: "updated", resource: "segment", logContext: { segmentId: input.segmentId } },
        ({ authentication, requestId, auditLog }) => {
          const { segmentId, ...changes } = input;
          return updateV3SegmentFromRawInput({
            segmentId,
            body: changes,
            authentication,
            requestId,
            instance: MCP_API_ROUTE,
            auditLog,
          });
        }
      )
  );

  registerScopedTool(
    server,
    "delete_segment",
    {
      title: "Delete segment",
      description:
        "Delete a segment. Refused with a 409 naming the surveys while any survey uses it. Segments that reference it in their filters stop matching.",
      inputSchema: ZMcpDeleteSegmentInput,
      outputSchema: ZMcpIdOutput,
      audit: { action: "deleted", targetType: "segment", targetIdArg: "segmentId" },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    ["contacts:write"],
    async (input: TMcpDeleteSegmentInput, ctx) =>
      runMcpMutation(
        ctx,
        { action: "deleted", resource: "segment", logContext: { segmentId: input.segmentId } },
        ({ authentication, requestId, auditLog }) =>
          deleteV3Segment({
            segmentId: input.segmentId,
            authentication,
            requestId,
            instance: MCP_API_ROUTE,
            auditLog,
          })
      )
  );
}
