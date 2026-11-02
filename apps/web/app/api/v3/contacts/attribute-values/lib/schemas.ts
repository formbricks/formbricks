import { z } from "zod";
import { zPostgresText } from "@/lib/utils/postgres-text";

export const V3_ATTRIBUTE_VALUES_DEFAULT_LIMIT = 50;
export const V3_ATTRIBUTE_VALUES_MAX_LIMIT = 100;

/** `GET /api/v3/contacts/attribute-values`. Strict: an unknown parameter is a 400 naming it. */
export const ZV3ContactAttributeValuesQuery = z
  .object({
    workspaceId: z.cuid2(),
    key: zPostgresText().min(1).max(255),
    "filter[value][contains]": zPostgresText()
      .max(512)
      .optional()
      .transform((value) => (value === undefined || value.trim() === "" ? undefined : value.trim())),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(V3_ATTRIBUTE_VALUES_MAX_LIMIT)
      .default(V3_ATTRIBUTE_VALUES_DEFAULT_LIMIT),
  })
  .strict();

export type TV3ContactAttributeValuesQuery = z.infer<typeof ZV3ContactAttributeValuesQuery>;
