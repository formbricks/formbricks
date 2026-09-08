import { FORBIDDEN_IDS } from "@formbricks/types/surveys/validation";

const FORBIDDEN_LOWER = new Set(FORBIDDEN_IDS.map((id) => id.toLowerCase()));
const REFUSED_SUFFIX = "_imported";

export type TEmbeddedDataFieldMapping = {
  source: string;
  fieldId: string;
  /** The name was reserved and had to be suffixed. */
  refused: boolean;
  /** The name changed in a way other than the reserved-name suffix. */
  renamed: boolean;
};

/**
 * Qualtrics embedded-data field → Formbricks hidden field id. One function so the Embedded Data project
 * can repoint it (§8): ids must match `^[a-z][a-z0-9_]*$`, reserved names get a suffix instead of being
 * lost.
 *
 * TODO(embedded-data): when the Embedded Data manager lands, map QSF embedded data onto `ingested`
 * fields and Formbricks variables onto `computed` fields here instead of hidden fields.
 */
export function mapEmbeddedDataFieldName(source: string): TEmbeddedDataFieldMapping {
  let fieldId = source
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9_]+/g, "_")
    .replaceAll(/_{2,}/g, "_")
    .replaceAll(/^_+|_+$/g, "");

  if (fieldId.length === 0) fieldId = "field";
  if (/^\d/.test(fieldId)) fieldId = `f_${fieldId}`;

  const refused = FORBIDDEN_LOWER.has(fieldId);
  if (refused) fieldId = `${fieldId}${REFUSED_SUFFIX}`;

  return { source, fieldId, refused, renamed: !refused && fieldId !== source };
}
