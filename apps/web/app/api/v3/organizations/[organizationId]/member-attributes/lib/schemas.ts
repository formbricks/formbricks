import { z } from "zod";
import {
  MEMBER_ATTRIBUTE_KEY_PATTERN,
  MEMBER_ATTRIBUTE_LIST_MAX_LIMIT,
  MEMBER_ATTRIBUTE_MAX_BULK_ROWS,
  MEMBER_ATTRIBUTE_MAX_DESCRIPTION_LENGTH,
  MEMBER_ATTRIBUTE_MAX_EMAIL_LENGTH,
  MEMBER_ATTRIBUTE_MAX_KEYS_PER_ROW,
  MEMBER_ATTRIBUTE_MAX_KEY_LENGTH,
  MEMBER_ATTRIBUTE_MAX_LABEL_LENGTH,
  MEMBER_ATTRIBUTE_MAX_SEARCH_LENGTH,
  MEMBER_ATTRIBUTE_MAX_VALUES_PER_KEY,
  MEMBER_ATTRIBUTE_MAX_VALUE_LENGTH,
  MEMBER_ATTRIBUTE_RESERVED_KEYS,
} from "@/modules/ee/member-attributes/lib/limits";

/**
 * Request schemas of the v3 Member attribute operations (ENG-7473). Hand-written beside the spec
 * (`docs/api-v3-reference/src/paths/api_v3_organizations_{organizationId}_member-attribute*.yml`), like
 * the tags routes; every object is strict, so an unknown key is a 400 rather than silently dropped.
 */

const noNul = (value: string) => !value.includes("\u0000");
const NUL_MESSAGE = "must not contain a NUL character";

export const ZV3OrganizationParams = z.strictObject({ organizationId: z.cuid2() });

export const ZV3MemberAttributeKeyParams = z.strictObject({
  organizationId: z.cuid2(),
  keyId: z.cuid2(),
});

const ZLabel = z
  .string()
  .trim()
  .min(1)
  .max(MEMBER_ATTRIBUTE_MAX_LABEL_LENGTH)
  .refine(noNul, { message: NUL_MESSAGE });

const ZDescription = z
  .string()
  .trim()
  .max(MEMBER_ATTRIBUTE_MAX_DESCRIPTION_LENGTH)
  .refine(noNul, { message: NUL_MESSAGE })
  .nullable()
  .transform((value) => (value === "" ? null : value));

export const ZV3CreateMemberAttributeKeyBody = z.strictObject({
  key: z
    .string()
    .min(1)
    .max(MEMBER_ATTRIBUTE_MAX_KEY_LENGTH)
    .regex(MEMBER_ATTRIBUTE_KEY_PATTERN, {
      message: "lowercase letters, numbers and underscores, starting with a letter",
    })
    .refine((key) => !MEMBER_ATTRIBUTE_RESERVED_KEYS.has(key), {
      message: "is reserved (email is the built-in Email attribute)",
      params: { code: "forbidden_identifier" },
    }),
  label: ZLabel,
  description: ZDescription.optional().default(null),
});

export const ZV3UpdateMemberAttributeKeyBody = z
  .strictObject({
    label: ZLabel.optional(),
    description: ZDescription.optional(),
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
  })
  .refine((body) => body.label !== undefined || body.description !== undefined, {
    message: "send label, description or both",
    path: ["label"],
  });

export const ZV3DeleteMemberAttributeKeyQuery = z.strictObject({
  expectedUpdatedAt: z.iso.datetime({ offset: true }).optional(),
});

export const ZV3MemberAttributesListQuery = z.strictObject({
  limit: z.coerce.number().int().min(1).max(MEMBER_ATTRIBUTE_LIST_MAX_LIMIT).optional(),
  cursor: z.string().min(1).max(512).optional(),
  search: z.string().max(MEMBER_ATTRIBUTE_MAX_SEARCH_LENGTH).optional(),
});

/**
 * Size bounds only: the semantic caps (values per key after deduplication, value length, unknown keys) are
 * per row, so one bad row is reported in the result rather than refusing the whole batch. These bounds
 * keep the request itself small — at most a few times the semantic caps.
 */
const ZBulkRow = z.strictObject({
  email: z.string().trim().min(1).max(MEMBER_ATTRIBUTE_MAX_EMAIL_LENGTH),
  attributes: z
    .record(
      z.string().min(1).max(MEMBER_ATTRIBUTE_MAX_KEY_LENGTH),
      z
        .array(z.string().max(MEMBER_ATTRIBUTE_MAX_VALUE_LENGTH * 4))
        .max(MEMBER_ATTRIBUTE_MAX_VALUES_PER_KEY * 4)
    )
    .refine((attributes) => Object.keys(attributes).length <= MEMBER_ATTRIBUTE_MAX_KEYS_PER_ROW, {
      message: `at most ${MEMBER_ATTRIBUTE_MAX_KEYS_PER_ROW} attributes per row`,
      params: { code: "limit_exceeded" },
    }),
});

export const ZV3BulkMemberAttributesBody = z.strictObject({
  rows: z.array(ZBulkRow).min(1).max(MEMBER_ATTRIBUTE_MAX_BULK_ROWS),
});

export type TV3BulkMemberAttributesBody = z.infer<typeof ZV3BulkMemberAttributesBody>;
