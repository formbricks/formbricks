import { z } from "zod";
import {
  MAX_EMBEDDED_KEY_LENGTH,
  isCompilableEmbeddedKey,
} from "@/modules/ee/analysis/lib/embedded-data-fields";
import {
  MAX_EMBEDDED_FIELD_LABEL_LENGTH,
  isStorableEmbeddedFieldLabel,
} from "@/modules/ee/analysis/lib/embedded-field-label-limits";

/**
 * `PUT /api/internal/embedded-field-labels`: the workspace's name for one imported (embedded-data) key. An
 * empty `label`, or the key itself, clears the name. `expectedLabel` guards against overwriting a rename
 * the editor never saw.
 */
export const ZInternalEmbeddedFieldLabelBody = z
  .object({
    workspaceId: z.cuid2(),
    key: z
      .string()
      .max(MAX_EMBEDDED_KEY_LENGTH)
      .refine(isCompilableEmbeddedKey, { message: "Must be an embedded-data key a chart can use" }),
    label: z
      .string()
      .max(MAX_EMBEDDED_FIELD_LABEL_LENGTH)
      .refine(isStorableEmbeddedFieldLabel, { message: "Must not contain control characters" }),
    /** The name the editor saw (`null`: none). A different stored name answers 409 and saves nothing. */
    expectedLabel: z.string().max(MAX_EMBEDDED_FIELD_LABEL_LENGTH).nullable(),
  })
  .strict();
export type TInternalEmbeddedFieldLabelBody = z.infer<typeof ZInternalEmbeddedFieldLabelBody>;
