import { z } from "zod";
import { MEMBER_ATTRIBUTE_MAX_SEARCH_LENGTH } from "@/modules/ee/member-attributes/lib/limits";
import { MCP_MAX_CURSOR_LENGTH } from "./audience-schemas";

/**
 * Input schemas for the read-only Member attribute tools (ENG-7479). Each maps onto one
 * `GET /api/v3/organizations/{organizationId}/...` operation, which owns access and validation; these give
 * an agent the shape and bounds and reject unknown keys.
 *
 * The page is capped below the API's 250: each row carries every attribute the person holds.
 */

export const MCP_MEMBER_ATTRIBUTES_MAX_LIMIT = 50;
const MCP_MEMBER_ATTRIBUTES_DEFAULT_LIMIT = 20;

const organizationIdField = z
  .cuid2()
  .describe("Organization ID (organizationId from list_workspaces) whose Member attributes to read.");

export const ZMcpListMemberAttributeKeysInput = z.strictObject({ organizationId: organizationIdField });

export type TMcpListMemberAttributeKeysInput = z.infer<typeof ZMcpListMemberAttributeKeysInput>;

export const ZMcpListMemberAttributesInput = z.strictObject({
  organizationId: organizationIdField,
  search: z
    .string()
    .trim()
    .min(1)
    .max(MEMBER_ATTRIBUTE_MAX_SEARCH_LENGTH)
    .optional()
    .describe("Only people whose name or email contains this text, ignoring case (e.g. a first name)."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(MCP_MEMBER_ATTRIBUTES_MAX_LIMIT)
    .default(MCP_MEMBER_ATTRIBUTES_DEFAULT_LIMIT)
    .describe(
      `Maximum number of people to return. Defaults to ${String(MCP_MEMBER_ATTRIBUTES_DEFAULT_LIMIT)}.`
    ),
  cursor: z
    .string()
    .min(1)
    .max(MCP_MAX_CURSOR_LENGTH)
    .optional()
    .describe("Opaque pagination cursor from a previous list_member_attributes response."),
});

export type TMcpListMemberAttributesInput = z.infer<typeof ZMcpListMemberAttributesInput>;
