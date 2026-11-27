import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZContactAttributeDataType } from "@formbricks/types/contact-attribute-key";
import { isSafeIdentifier } from "@formbricks/types/safe-identifier";
import { ZStoredText } from "@/app/api/internal/lib/stored-text";
import {
  RESERVED_FUTURE_DEFAULT_ATTRIBUTE_KEY_VALIDATION_MESSAGE,
  isReservedFutureDefaultAttributeKey,
} from "@/modules/ee/contacts/lib/attribute-key-policy";

/** Longest attribute key and label a write may set: far above any the attributes table shows in full. */
export const ATTRIBUTE_KEY_MAX_LENGTH = 255;
export const ATTRIBUTE_NAME_MAX_LENGTH = 255;

/** Longest attribute description a write may set. */
export const ATTRIBUTE_DESCRIPTION_MAX_LENGTH = 2000;

/**
 * `POST /api/internal/contact-attribute-keys` body, with the server action's key rules: a safe identifier
 * that isn't one of the keys reserved for future default attributes.
 */
export const ZCreateContactAttributeKeyBody = z
  .object({
    workspaceId: ZId,
    key: z
      .string()
      .max(ATTRIBUTE_KEY_MAX_LENGTH)
      .refine((val) => isSafeIdentifier(val), {
        error:
          "Key must be a safe identifier: only lowercase letters, numbers, and underscores, and must start with a letter",
      })
      .refine((val) => !isReservedFutureDefaultAttributeKey(val), {
        error: RESERVED_FUTURE_DEFAULT_ATTRIBUTE_KEY_VALIDATION_MESSAGE,
      }),
    name: ZStoredText(ATTRIBUTE_NAME_MAX_LENGTH).optional(),
    description: ZStoredText(ATTRIBUTE_DESCRIPTION_MAX_LENGTH).optional(),
    dataType: ZContactAttributeDataType.optional(),
  })
  .strict();

export type TCreateContactAttributeKeyBody = z.infer<typeof ZCreateContactAttributeKeyBody>;

/** `PATCH /api/internal/contact-attribute-keys/{contactAttributeKeyId}` body: the label and description. */
export const ZUpdateContactAttributeKeyBody = z
  .object({
    name: ZStoredText(ATTRIBUTE_NAME_MAX_LENGTH).optional(),
    description: ZStoredText(ATTRIBUTE_DESCRIPTION_MAX_LENGTH).optional(),
  })
  .strict();

export type TUpdateContactAttributeKeyBody = z.infer<typeof ZUpdateContactAttributeKeyBody>;

export const ZContactAttributeKeyParams = z.object({ contactAttributeKeyId: ZId }).strict();
