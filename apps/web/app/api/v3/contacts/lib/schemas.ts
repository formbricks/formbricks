import { z } from "zod";
import { ZContactAttributeDataType } from "@formbricks/types/contact-attribute-key";
import { isSafeIdentifier } from "@formbricks/types/safe-identifier";
import {
  RESERVED_FUTURE_DEFAULT_ATTRIBUTE_KEY_VALIDATION_MESSAGE,
  isReservedFutureDefaultAttributeKey,
} from "@/modules/ee/contacts/lib/attribute-key-policy";

/** Default and maximum page size of `GET /api/v3/contacts`. A contact carries every attribute, so pages stay small. */
export const V3_CONTACTS_DEFAULT_LIMIT = 20;
export const V3_CONTACTS_MAX_LIMIT = 100;

/**
 * Most attributes a single call may set. Mirrors `MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT`, the number of
 * attribute keys a workspace may have at all, so a call carrying more can never be satisfied. Declared here
 * rather than imported because that constant lives in `@/lib/constants`, which reads the validated server
 * env at import time and has no business in a schema module the MCP layer also loads.
 */
export const V3_CONTACT_MAX_ATTRIBUTES = 150;

/**
 * Longest attribute value or filter value. Values are indexed (`ContactAttribute(attributeKeyId, value)`)
 * and a btree entry over ~2.7 kB is a database error, which would otherwise surface as a 500 for input the
 * caller can fix. 500 characters stays under it even for 4-byte code points.
 */
export const V3_CONTACT_ATTRIBUTE_VALUE_MAX_LENGTH = 500;

const V3_CONTACT_ATTRIBUTE_KEY_MAX_LENGTH = 100;

/**
 * Keys a contact always keeps. `updateAttributes` already refuses to delete these when a form drops them
 * (`DEFAULT_ATTRIBUTES` in `modules/ee/contacts/lib/attributes.ts`, module-private), and the explicit
 * `removeAttributeKeys` list has to honour the same rule instead of becoming a way around it.
 */
export const V3_PROTECTED_CONTACT_ATTRIBUTE_KEYS = ["userId", "email", "firstName", "lastName"] as const;

const ZV3ContactAttributeValue = z.union([
  z.string().min(1).max(V3_CONTACT_ATTRIBUTE_VALUE_MAX_LENGTH),
  z.number(),
  z.boolean(),
]);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * A map of attribute key to value. The key count is checked *before* the entries are parsed, for the reason
 * `lengthBoundedArray` exists: a 2 MB body of junk entries would otherwise cost one issue per entry.
 */
const boundedAttributeMap = <TSchema extends z.ZodType>(inner: TSchema) =>
  z.preprocess((value, ctx) => {
    if (isPlainObject(value) && Object.keys(value).length > V3_CONTACT_MAX_ATTRIBUTES) {
      ctx.addIssue({
        code: "custom",
        message: `Too many attributes: at most ${V3_CONTACT_MAX_ATTRIBUTES} per call`,
        input: value,
      });
      return z.NEVER;
    }
    return value;
  }, inner);

/** `attributes` as sent on a write. Email must look like one, as the UI form and the v2 API require. */
export const ZV3ContactAttributesInput = boundedAttributeMap(
  z
    .record(z.string().min(1).max(V3_CONTACT_ATTRIBUTE_KEY_MAX_LENGTH), ZV3ContactAttributeValue)
    .superRefine((attributes, ctx) => {
      const email = attributes.email;
      if (email !== undefined && !(typeof email === "string" && z.email().safeParse(email).success)) {
        ctx.addIssue({ code: "custom", message: "email must be a valid email address", path: ["email"] });
      }
    })
);

/** The one place the contact filters are declared, so list and count cannot drift apart. */
const contactFilterShape = {
  workspaceId: z.cuid2(),
  userId: z.string().min(1).max(V3_CONTACT_ATTRIBUTE_VALUE_MAX_LENGTH).optional(),
  attributeKey: z.string().min(1).max(V3_CONTACT_ATTRIBUTE_KEY_MAX_LENGTH).optional(),
  attributeValue: z.string().min(1).max(V3_CONTACT_ATTRIBUTE_VALUE_MAX_LENGTH).optional(),
};

type TContactFilterFields = {
  attributeKey?: string;
  attributeValue?: string;
};

/** A value without a key (or the reverse) would match nothing, or everything: refuse it instead. */
const attributeFilterIsComplete = ({ attributeKey, attributeValue }: TContactFilterFields): boolean =>
  (attributeKey === undefined) === (attributeValue === undefined);

const ATTRIBUTE_FILTER_PAIR_MESSAGE = "attributeKey and attributeValue must be given together";

export const ZV3ContactListQueryBase = z
  .object({
    ...contactFilterShape,
    limit: z.coerce.number().int().min(1).max(V3_CONTACTS_MAX_LIMIT).default(V3_CONTACTS_DEFAULT_LIMIT),
    cursor: z.string().min(1).max(512).optional(),
  })
  .strict();

export const ZV3ContactListQuery = ZV3ContactListQueryBase.refine(attributeFilterIsComplete, {
  error: ATTRIBUTE_FILTER_PAIR_MESSAGE,
  path: ["attributeValue"],
});

export const ZV3ContactCountQueryBase = z.object(contactFilterShape).strict();

export const ZV3ContactCountQuery = ZV3ContactCountQueryBase.refine(attributeFilterIsComplete, {
  error: ATTRIBUTE_FILTER_PAIR_MESSAGE,
  path: ["attributeValue"],
});

export const ZV3ContactIdParams = z.object({ contactId: z.cuid2() }).strict();

/**
 * Create the contact for `userId`, or update it when one already exists in the workspace. `userId` is the
 * identity, so it is a field of its own rather than a key of `attributes`.
 */
export const ZV3UpsertContactBody = z
  .object({
    workspaceId: z.cuid2(),
    userId: z.string().trim().min(1).max(V3_CONTACT_ATTRIBUTE_VALUE_MAX_LENGTH),
    attributes: ZV3ContactAttributesInput.optional(),
  })
  .strict()
  .refine((body) => !(body.attributes && "userId" in body.attributes), {
    error: "Set the userId with the top-level userId field, not inside attributes",
    path: ["attributes", "userId"],
  });

const ZV3RemoveAttributeKeys = z
  .array(z.string().min(1).max(V3_CONTACT_ATTRIBUTE_KEY_MAX_LENGTH))
  .min(1)
  .max(V3_CONTACT_MAX_ATTRIBUTES);

const protectedKeys: ReadonlySet<string> = new Set(V3_PROTECTED_CONTACT_ATTRIBUTE_KEYS);

/** Attributes to set (merged into what the contact has) and attribute keys to remove from it. */
export const ZV3PatchContactBody = z
  .object({
    attributes: ZV3ContactAttributesInput.optional(),
    removeAttributeKeys: ZV3RemoveAttributeKeys.optional(),
  })
  .strict()
  .superRefine((body, ctx) => {
    if (body.attributes === undefined && body.removeAttributeKeys === undefined) {
      ctx.addIssue({ code: "custom", message: "Provide attributes, removeAttributeKeys or both" });
    }
    body.removeAttributeKeys?.forEach((key, index) => {
      if (protectedKeys.has(key)) {
        ctx.addIssue({
          code: "custom",
          message: `${key} is a default attribute and cannot be removed`,
          path: ["removeAttributeKeys", index],
        });
      } else if (body.attributes && key in body.attributes) {
        ctx.addIssue({
          code: "custom",
          message: `${key} cannot be set and removed in the same call`,
          path: ["removeAttributeKeys", index],
        });
      }
    });
  });

export const ZV3CreateContactAttributeKeyBody = z
  .object({
    workspaceId: z.cuid2(),
    key: z
      .string()
      .max(V3_CONTACT_ATTRIBUTE_KEY_MAX_LENGTH)
      .refine(isSafeIdentifier, {
        error:
          "Key must be a safe identifier: only lowercase letters, numbers, and underscores, and must start with a letter",
      })
      .refine((key) => !isReservedFutureDefaultAttributeKey(key), {
        error: RESERVED_FUTURE_DEFAULT_ATTRIBUTE_KEY_VALIDATION_MESSAGE,
      }),
    name: z.string().trim().min(1).max(255).optional(),
    description: z.string().max(1000).optional(),
    dataType: ZContactAttributeDataType.optional(),
  })
  .strict();

export const ZV3ContactAttributeKeyIdParams = z.object({ attributeKeyId: z.cuid2() }).strict();

export const ZV3PatchContactAttributeKeyBody = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    description: z.string().max(1000).optional(),
  })
  .strict()
  .refine((body) => body.name !== undefined || body.description !== undefined, {
    error: "Provide name, description or both",
  });

/** A contact as the v3 API answers it, so MCP output schemas derive from it instead of retyping the shape. */
export const ZV3ContactResource = z.object({
  id: z.string(),
  workspaceId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  attributes: z.record(z.string(), z.string()),
});

/** What a delete answers: only the id that no longer resolves. Shared by contacts and attribute keys. */
export const ZV3IdResource = z.object({ id: z.string() });

export type TV3ContactListQuery = z.infer<typeof ZV3ContactListQuery>;
export type TV3ContactCountQuery = z.infer<typeof ZV3ContactCountQuery>;
export type TV3ContactIdParams = z.infer<typeof ZV3ContactIdParams>;
export type TV3UpsertContactBody = z.infer<typeof ZV3UpsertContactBody>;
export type TV3PatchContactBody = z.infer<typeof ZV3PatchContactBody>;
export type TV3CreateContactAttributeKeyBody = z.infer<typeof ZV3CreateContactAttributeKeyBody>;
export type TV3PatchContactAttributeKeyBody = z.infer<typeof ZV3PatchContactAttributeKeyBody>;
export type TV3ContactResource = z.infer<typeof ZV3ContactResource>;
