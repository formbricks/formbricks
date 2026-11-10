import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ATTRIBUTE_KEY_MAX_LENGTH } from "@/app/api/internal/contact-attribute-keys/schemas";
import { MAX_CONTACT_ATTRIBUTES_PER_REQUEST } from "@/lib/constants";

/**
 * Longest attribute value an edit may set. Far above any value the contact page shows, and generous
 * enough that a value stored through another path (the SDK, a CSV import) never blocks saving the form,
 * which sends every attribute back.
 */
export const CONTACT_ATTRIBUTE_VALUE_MAX_LENGTH = 65_536;

export const ZContactParams = z.object({ contactId: ZId }).strict();

/**
 * `PUT /api/internal/contacts/{contactId}/attributes` body: every attribute the contact keeps, by key (the
 * form sends them all; one left out is removed). The values `ZContactAttributesInput` takes, bounded: at most
 * `MAX_CONTACT_ATTRIBUTES_PER_REQUEST` keys, each a key the attributes page can hold.
 */
export const ZContactAttributesBody = z
  .object({
    attributes: z
      .record(
        z.string().max(ATTRIBUTE_KEY_MAX_LENGTH),
        z.union([z.string().max(CONTACT_ATTRIBUTE_VALUE_MAX_LENGTH), z.number(), z.boolean()])
      )
      .refine((attributes) => Object.keys(attributes).length <= MAX_CONTACT_ATTRIBUTES_PER_REQUEST, {
        error: `A contact may be saved with at most ${MAX_CONTACT_ATTRIBUTES_PER_REQUEST} attributes`,
      }),
  })
  .strict();

export type TContactAttributesBody = z.infer<typeof ZContactAttributesBody>;

/**
 * `POST /api/internal/contacts/{contactId}/personal-links` body: the survey the link opens, and how many
 * days it stays valid (none: it doesn't expire).
 */
export const ZContactPersonalLinkBody = z
  .object({
    surveyId: ZId,
    // Whole days; the cap (a century) only bounds the token's lifetime.
    expirationDays: z.number().int().min(1).max(36_500).optional(),
  })
  .strict();

export type TContactPersonalLinkBody = z.infer<typeof ZContactPersonalLinkBody>;
