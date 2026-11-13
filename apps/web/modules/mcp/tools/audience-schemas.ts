import { z } from "zod";
import { ZContactAttributeDataType, ZContactAttributeKeyType } from "@formbricks/types/contact-attribute-key";
import { V3_CONTACT_ATTRIBUTE_KEY_SORTS } from "@/app/api/v3/contact-attribute-keys/lib/parse-v3-contact-attribute-keys-list-query";
import { V3_ATTRIBUTE_VALUES_MAX_LIMIT } from "@/app/api/v3/contacts/attribute-values/lib/schemas";
import {
  DATE_OPERATORS,
  NUMBER_OPERATORS,
  STRING_OPERATORS,
  V3_CONTACTS_MAX_IN_VALUES,
} from "@/app/api/v3/contacts/lib/parse-v3-contacts-list-query";
import { lengthBoundedArray } from "@/app/api/v3/lib/bounded-array";
import { V3_SEGMENT_SORTS } from "@/app/api/v3/segments/lib/parse-v3-segments-list-query";

/**
 * Input schemas for the read-only Audience tools (ENG-7151): contacts, contact attributes, segments and
 * action classes. Each maps onto the query of one `GET /api/v3/...` list operation, whose parser stays the
 * one that validates it — these schemas give an agent the shape and the bounds, and reject unknown keys
 * (ENG-2256).
 *
 * Page sizes are capped below the API's: a contact carries every attribute it has and a segment its whole
 * filter tree, and an agent's context is the binding constraint.
 */

const MCP_MAX_ATTRIBUTE_FILTERS = 20;
const MCP_MAX_FILTER_VALUES = 10;

const workspaceIdField = (what: string) => z.cuid2().describe(`Workspace ID whose ${what} should be listed.`);

const limitField = (what: string, max: number, fallback: number) =>
  z
    .number()
    .int()
    .min(1)
    .max(max)
    .default(fallback)
    .describe(`Maximum number of ${what} to return. Defaults to ${String(fallback)}.`);

const cursorField = (tool: string) =>
  z.string().min(1).optional().describe(`Opaque pagination cursor from a previous ${tool} response.`);

const includeTotalCountField = z
  .boolean()
  .default(false)
  .describe("Also count every match across all pages (meta.totalCount). Off by default.");

const ATTRIBUTE_OPERATORS = [
  ...new Set<string>([...STRING_OPERATORS, ...NUMBER_OPERATORS, ...DATE_OPERATORS]),
] as [string, ...string[]];

/** Operators that test whether a value exists and take none. */
const VALUELESS_OPERATORS = new Set(["isSet", "isNotSet"]);

const ZMcpContactAttributeFilter = z
  .strictObject({
    key: z
      .string()
      .min(1)
      .max(255)
      .describe("Contact attribute key, as list_contact_attribute_keys returns it."),
    operator: z
      .enum(ATTRIBUTE_OPERATORS)
      .describe(
        "string keys: in, eq, ne, contains, notContains, startsWith, endsWith, isSet, isNotSet. number keys: in, eq, ne, gt, gte, lt, lte, isSet, isNotSet. date keys: gte, lte, isSet, isNotSet."
      ),
    values: lengthBoundedArray(z.string().max(512), {
      max: V3_CONTACTS_MAX_IN_VALUES,
      description:
        "Values to compare with. One value except for in (any of), and ne, contains, notContains, startsWith, endsWith (all of). Dates are ISO 8601 with an offset. Omit for isSet and isNotSet.",
    }).optional(),
  })
  // Without this a valued operator sent with no value would reach the query as no filter at all, and the
  // list would silently hold more contacts than the agent asked for.
  .refine((filter) => VALUELESS_OPERATORS.has(filter.operator) || (filter.values?.length ?? 0) > 0, {
    message: "values is required for every operator except isSet and isNotSet.",
    path: ["values"],
  });

export type TMcpContactAttributeFilter = z.infer<typeof ZMcpContactAttributeFilter>;

export const ZMcpListContactsInput = z.strictObject({
  workspaceId: workspaceIdField("contacts"),
  limit: limitField("contacts", 50, 20),
  cursor: cursorField("list_contacts"),
  includeTotalCount: includeTotalCountField,
  search: z
    .string()
    .max(512)
    .optional()
    .describe("Case-insensitive text matched against the contact's id and attribute values."),
  sortBy: z
    .enum(["-createdAt", "createdAt"])
    .optional()
    .describe("Sort by creation time, newest first (-createdAt, the default) or oldest first."),
  filter: z
    .strictObject({
      createdAt: z
        .strictObject({
          gte: z.iso.datetime({ offset: true }).optional().describe("Created at or after (ISO 8601)."),
          lte: z.iso.datetime({ offset: true }).optional().describe("Created at or before (ISO 8601)."),
        })
        .optional()
        .describe("Filter by creation time."),
      attributes: lengthBoundedArray(ZMcpContactAttributeFilter, {
        max: MCP_MAX_ATTRIBUTE_FILTERS,
        description: "Attribute filters, all of which must match.",
      }).optional(),
    })
    .optional()
    .describe("Optional filters."),
});

export type TMcpListContactsInput = z.infer<typeof ZMcpListContactsInput>;

export const ZMcpListContactAttributeKeysInput = z.strictObject({
  workspaceId: workspaceIdField("contact attribute keys"),
  limit: limitField("attribute keys", 100, 50),
  cursor: cursorField("list_contact_attribute_keys"),
  includeTotalCount: includeTotalCountField,
  search: z
    .string()
    .max(512)
    .optional()
    .describe("Case-insensitive text matched against key, name and description."),
  sortBy: z
    .enum(V3_CONTACT_ATTRIBUTE_KEY_SORTS)
    .optional()
    .describe("Sort order. Omit for the stable default order."),
  filter: z
    .strictObject({
      dataType: z
        .strictObject({
          in: lengthBoundedArray(ZContactAttributeDataType, {
            min: 1,
            max: MCP_MAX_FILTER_VALUES,
            description: "Data types to include: string, number or date.",
          }),
        })
        .optional()
        .describe("Filter by data type."),
      type: z
        .strictObject({
          in: lengthBoundedArray(ZContactAttributeKeyType, {
            min: 1,
            max: MCP_MAX_FILTER_VALUES,
            description: "Key types to include: default or custom.",
          }),
        })
        .optional()
        .describe("Filter by key type."),
    })
    .optional()
    .describe("Optional filters."),
});

export type TMcpListContactAttributeKeysInput = z.infer<typeof ZMcpListContactAttributeKeysInput>;

export const ZMcpListContactAttributeValuesInput = z.strictObject({
  workspaceId: z.cuid2().describe("Workspace ID the attribute key belongs to."),
  key: z.string().min(1).max(255).describe("Contact attribute key whose distinct values should be listed."),
  limit: limitField("values", V3_ATTRIBUTE_VALUES_MAX_LIMIT, 50),
  filter: z
    .strictObject({
      value: z
        .strictObject({
          contains: z.string().max(512).optional().describe("Case-insensitive substring of the value."),
        })
        .optional()
        .describe("Filter by value."),
    })
    .optional()
    .describe("Optional filters."),
});

export type TMcpListContactAttributeValuesInput = z.infer<typeof ZMcpListContactAttributeValuesInput>;

export const ZMcpListSegmentsInput = z.strictObject({
  workspaceId: workspaceIdField("segments"),
  limit: limitField("segments", 50, 20),
  cursor: cursorField("list_segments"),
  includeTotalCount: includeTotalCountField,
  sortBy: z
    .enum(V3_SEGMENT_SORTS)
    .optional()
    .describe("Sort order: -updatedAt (the default), -createdAt or title."),
  filter: z
    .strictObject({
      title: z
        .strictObject({
          contains: z.string().max(512).optional().describe("Case-insensitive substring of the title."),
        })
        .optional()
        .describe("Filter by title."),
    })
    .optional()
    .describe("Optional filters."),
});

export type TMcpListSegmentsInput = z.infer<typeof ZMcpListSegmentsInput>;

export const ZMcpListActionClassesInput = z.strictObject({
  workspaceId: workspaceIdField("action classes"),
  limit: limitField("action classes", 100, 50),
  cursor: cursorField("list_action_classes"),
});

export type TMcpListActionClassesInput = z.infer<typeof ZMcpListActionClassesInput>;
