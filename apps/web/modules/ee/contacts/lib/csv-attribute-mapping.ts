import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { isSafeIdentifier } from "@formbricks/types/safe-identifier";
import { isStringMatch } from "@/lib/utils/strings";
import { isReservedFutureDefaultAttributeKey } from "@/modules/ee/contacts/lib/attribute-key-policy";

/**
 * The initial CSV column → attribute mapping: each column maps to the first attribute key whose name
 * (or key, when it has no name) it matches, and otherwise to its own name, to be created as a new key.
 */
export const matchCsvColumnsToAttributeKeys = (
  csvColumns: string[],
  contactAttributeKeys: TContactAttributeKey[]
): Record<string, string> => {
  const matches: Record<string, string> = {};

  for (const columnName of csvColumns) {
    const matchingKey = contactAttributeKeys.find((attributeKey) =>
      isStringMatch(columnName, attributeKey.name ?? attributeKey.key)
    );
    matches[columnName] = matchingKey ? matchingKey.id : columnName;
  }

  return matches;
};

/**
 * Columns whose mapping would create an attribute key that cannot exist: not a safe identifier, or
 * reserved for the default-attribute migration. Columns mapped to an existing key are always fine.
 */
export const findUnmappableCsvColumns = (
  csvColumns: string[],
  attributeMap: Record<string, string>,
  contactAttributeKeys: TContactAttributeKey[]
): { invalidColumns: string[]; reservedColumns: string[] } => {
  const invalidColumns: string[] = [];
  const reservedColumns: string[] = [];

  for (const columnName of csvColumns) {
    const mappedAttribute = attributeMap[columnName];
    if (!mappedAttribute) {
      continue;
    }

    const mapsToExistingAttribute = contactAttributeKeys.some(
      (attributeKey) => attributeKey.id === mappedAttribute
    );

    if (mapsToExistingAttribute) {
      continue;
    }

    if (!isSafeIdentifier(mappedAttribute)) {
      invalidColumns.push(columnName);
      continue;
    }

    if (isReservedFutureDefaultAttributeKey(mappedAttribute)) {
      reservedColumns.push(columnName);
    }
  }

  return { invalidColumns, reservedColumns };
};
