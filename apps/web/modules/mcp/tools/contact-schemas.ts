import { z } from "zod";
import {
  ATTRIBUTE_FILTER_PAIR_CHECK,
  PATCH_ATTRIBUTE_KEY_CHECK,
  UPSERT_CONTACT_CHECK,
  V3_CONTACT_MAX_ATTRIBUTES,
  ZV3ContactCountQueryBase,
  ZV3ContactListQueryBase,
  ZV3CreateContactAttributeKeyBody,
  ZV3PatchContactAttributeKeyBodyBase,
  ZV3PatchContactBodyBase,
  ZV3UpsertContactBodyBase,
  checkPatchContactBody,
} from "@/app/api/v3/contacts/lib/schemas";
import { lengthBoundedArray } from "@/app/api/v3/lib/bounded-array";
import {
  PATCH_SEGMENT_CHECK,
  ZV3CreateSegmentBody,
  ZV3PatchSegmentBodyBase,
  ZV3SegmentListQuery,
} from "@/app/api/v3/segments/lib/schemas";

/**
 * Input schemas for the contact and segment tools. Every object is strict, so a misspelled filter is an
 * error instead of a query that quietly runs wider than asked (see the note in `./schemas.ts`), and every
 * field extends or reads the v3 schema it mirrors instead of restating it.
 *
 * Object-level rules of the v3 bodies (a value needs its key, nothing to change, ...) are re-applied with
 * the very functions the routes use, because `.extend()` is not allowed on a refined schema.
 */

const workspaceIdField = z.cuid2().describe("Workspace ID. Use list_workspaces to discover ids.");

/** Smaller than the REST ceiling of 100: a contact carries every attribute, and context is the constraint. */
const MCP_MAX_PAGE = 50;

const limitField = (noun: string) =>
  z
    .number()
    .int()
    .min(1)
    .max(MCP_MAX_PAGE)
    .default(20)
    .describe(`Maximum number of ${noun} to return. Defaults to 20.`);

const cursorField = (tool: string) =>
  z.string().min(1).max(512).optional().describe(`Opaque pagination cursor from a previous ${tool} result.`);

const contactFilterFields = {
  workspaceId: workspaceIdField.describe("Workspace whose contacts are in scope."),
  userId: ZV3ContactListQueryBase.shape.userId.describe("Only the contact with this userId."),
  attributeKey: ZV3ContactListQueryBase.shape.attributeKey.describe(
    "Only contacts whose attribute with this key equals attributeValue. Give both or neither."
  ),
  attributeValue: ZV3ContactListQueryBase.shape.attributeValue.describe(
    "The exact value attributeKey must have, as stored text."
  ),
};

export const ZMcpListContactsInput = ZV3ContactListQueryBase.extend({
  ...contactFilterFields,
  limit: limitField("contacts"),
  cursor: cursorField("list_contacts"),
})
  .strict()
  .refine(ATTRIBUTE_FILTER_PAIR_CHECK.check, ATTRIBUTE_FILTER_PAIR_CHECK.params);

export const ZMcpCountContactsInput = ZV3ContactCountQueryBase.extend(contactFilterFields)
  .strict()
  .refine(ATTRIBUTE_FILTER_PAIR_CHECK.check, ATTRIBUTE_FILTER_PAIR_CHECK.params);

const contactIdField = z.cuid2().describe("Contact ID. Use list_contacts to discover ids.");

export const ZMcpGetContactInput = z.object({ contactId: contactIdField }).strict();

export const ZMcpUpsertContactInput = ZV3UpsertContactBodyBase.extend({
  workspaceId: workspaceIdField.describe("Workspace the contact belongs to."),
  userId: ZV3UpsertContactBodyBase.shape.userId.describe(
    "The contact's userId. An existing contact with this userId is updated, otherwise one is created."
  ),
  attributes: ZV3UpsertContactBodyBase.shape.attributes.describe(
    `Attributes to set, as {key: value} with string, number or boolean values (at most ${V3_CONTACT_MAX_ATTRIBUTES}). Merged into what the contact already has. A new key is created with the type its first value implies, and email must be unique in the workspace. Anything skipped comes back in warnings.`
  ),
})
  .strict()
  .refine(UPSERT_CONTACT_CHECK.check, UPSERT_CONTACT_CHECK.params);

export const ZMcpUpdateContactInput = ZV3PatchContactBodyBase.extend({
  contactId: contactIdField,
  attributes: ZV3PatchContactBodyBase.shape.attributes.describe(
    "Attributes to set, as {key: value}. Merged into what the contact already has, so omitted attributes stay. Anything skipped comes back in warnings."
  ),
  removeAttributeKeys: ZV3PatchContactBodyBase.shape.removeAttributeKeys.describe(
    "Attribute keys to remove from this contact. userId, email, firstName and lastName cannot be removed."
  ),
})
  .strict()
  .superRefine(checkPatchContactBody);

/**
 * A literal `true`, required. Deleting a contact also deletes their responses and displays, and
 * deleting an attribute key deletes every contact's value for it; neither can be undone.
 */
const confirmField = (consequence: string) =>
  z.literal(true).describe(`Must be true. Set it only once the user has agreed: ${consequence}`);

export const ZMcpDeleteContactInput = z
  .object({
    contactId: contactIdField,
    confirm: confirmField("this permanently deletes the contact together with their responses and displays."),
  })
  .strict();

export const ZMcpCreateContactAttributeKeyInput = ZV3CreateContactAttributeKeyBody.extend({
  workspaceId: workspaceIdField.describe("Workspace the attribute key belongs to."),
  key: ZV3CreateContactAttributeKeyBody.shape.key.describe(
    "Key, lowercase letters, digits and underscores, starting with a letter. userId, email, firstName, lastName and language already exist."
  ),
  name: ZV3CreateContactAttributeKeyBody.shape.name.describe("Display name. Defaults to a title-cased key."),
  description: ZV3CreateContactAttributeKeyBody.shape.description.describe("What the attribute holds."),
  dataType: ZV3CreateContactAttributeKeyBody.shape.dataType.describe(
    "string (default), number or date. Segment filters use it to pick the operators."
  ),
}).strict();

const attributeKeyIdField = z.cuid2().describe("Attribute key ID. Use list_contact_attribute_keys for ids.");

export const ZMcpUpdateContactAttributeKeyInput = ZV3PatchContactAttributeKeyBodyBase.extend({
  attributeKeyId: attributeKeyIdField,
  name: ZV3PatchContactAttributeKeyBodyBase.shape.name.describe("New display name."),
  description: ZV3PatchContactAttributeKeyBodyBase.shape.description.describe("New description."),
})
  .strict()
  .refine(PATCH_ATTRIBUTE_KEY_CHECK.check, PATCH_ATTRIBUTE_KEY_CHECK.params);

export const ZMcpDeleteContactAttributeKeyInput = z
  .object({
    attributeKeyId: attributeKeyIdField,
    confirm: confirmField("this deletes every contact's value for the attribute and cannot be undone."),
  })
  .strict();

export const ZMcpListSegmentsInput = ZV3SegmentListQuery.extend({
  workspaceId: workspaceIdField.describe("Workspace whose segments should be listed."),
  limit: limitField("segments"),
  cursor: cursorField("list_segments"),
}).strict();

const segmentIdField = z.cuid2().describe("Segment ID. Use list_segments to discover ids.");

export const ZMcpGetSegmentInput = z.object({ segmentId: segmentIdField }).strict();

/**
 * The grammar, because the tree is recursive and is not advertised as a schema: the v3 contract validates
 * it when the call reaches the operation, which answers with the node that is wrong. Spent once, here,
 * since a wrong guess at this shape is the likeliest silent failure of the segment tools.
 */
const FILTERS_DESCRIPTION = [
  "Filter tree, at least one node: [{id, connector, resource}].",
  "id: any unique lowercase alphanumeric string per node, e.g. f1.",
  "connector: null on the first node, then and|or (and binds tighter than or).",
  "resource: one filter {id, root, qualifier: {operator}, value}, or a nested array of nodes to group.",
  "root and its operators:",
  "{type: attribute, contactAttributeKey: <an attribute key of the workspace>} with equals, notEquals,",
  "lessThan, lessEqual, greaterThan, greaterEqual (number value), contains, doesNotContain, startsWith,",
  "endsWith (string value), isSet, isNotSet (value ignored but required), isOlderThan, isNewerThan",
  "(value {amount, unit: days|weeks|months|years}), isBefore, isAfter, isSameDay (ISO date string),",
  "isBetween (value [from, to]);",
  "{type: person, personIdentifier: userId} with the string operators;",
  "{type: segment, segmentId} with userIsIn|userIsNotIn;",
  "{type: device, deviceType: phone|desktop} with equals|notEquals and value phone|desktop;",
  "{type: surveyInteraction} with haveSeen, haveNotSeen, haveStartedRespondingTo, haveCompleted,",
  "haveNotCompleted and value {surveyScope: any|specific, surveyIds: [...], within: {amount, unit:",
  "days|weeks|months}}.",
  "Attribute keys, segment ids and survey ids must exist in the workspace.",
].join(" ");

/** A node is validated by `ZSegmentFilters` in the operation; here it is only bounded. */
const filtersField = lengthBoundedArray(z.record(z.string(), z.unknown()), {
  min: 1,
  max: 100,
  description: FILTERS_DESCRIPTION,
});

export const ZMcpCreateSegmentInput = z
  .object({
    workspaceId: workspaceIdField.describe("Workspace the segment belongs to."),
    title: ZV3CreateSegmentBody.shape.title.describe("Unique title within the workspace."),
    description: ZV3CreateSegmentBody.shape.description.describe("What the segment is for."),
    filters: filtersField,
  })
  .strict();

export const ZMcpUpdateSegmentInput = ZV3PatchSegmentBodyBase.extend({
  segmentId: segmentIdField,
  title: ZV3PatchSegmentBodyBase.shape.title.describe("New title, unique within the workspace."),
  description: ZV3PatchSegmentBodyBase.shape.description.describe("New description, or null to clear it."),
  // Replaces the whole tree, which is why it is described as such rather than as an edit.
  filters: filtersField
    .optional()
    .describe(`Replaces the whole filter tree when given. ${FILTERS_DESCRIPTION}`),
})
  .strict()
  .refine(
    ({ segmentId: _segmentId, ...changes }) => PATCH_SEGMENT_CHECK.check(changes),
    PATCH_SEGMENT_CHECK.params
  );

export const ZMcpDeleteSegmentInput = z.object({ segmentId: segmentIdField }).strict();

export type TMcpListContactsInput = z.infer<typeof ZMcpListContactsInput>;
export type TMcpCountContactsInput = z.infer<typeof ZMcpCountContactsInput>;
export type TMcpGetContactInput = z.infer<typeof ZMcpGetContactInput>;
export type TMcpUpsertContactInput = z.infer<typeof ZMcpUpsertContactInput>;
export type TMcpUpdateContactInput = z.infer<typeof ZMcpUpdateContactInput>;
export type TMcpDeleteContactInput = z.infer<typeof ZMcpDeleteContactInput>;
export type TMcpCreateContactAttributeKeyInput = z.infer<typeof ZMcpCreateContactAttributeKeyInput>;
export type TMcpUpdateContactAttributeKeyInput = z.infer<typeof ZMcpUpdateContactAttributeKeyInput>;
export type TMcpDeleteContactAttributeKeyInput = z.infer<typeof ZMcpDeleteContactAttributeKeyInput>;
export type TMcpListSegmentsInput = z.infer<typeof ZMcpListSegmentsInput>;
export type TMcpGetSegmentInput = z.infer<typeof ZMcpGetSegmentInput>;
export type TMcpCreateSegmentInput = z.infer<typeof ZMcpCreateSegmentInput>;
export type TMcpUpdateSegmentInput = z.infer<typeof ZMcpUpdateSegmentInput>;
export type TMcpDeleteSegmentInput = z.infer<typeof ZMcpDeleteSegmentInput>;
