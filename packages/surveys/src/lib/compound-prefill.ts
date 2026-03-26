import { type TResponseData } from "@formbricks/types/responses";
import { ALL_COMPOUND_FIELD_INDICES } from "@formbricks/types/surveys/compound-fields";
import { TSurveyElement, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";

const COMPOUND_TYPES = new Set([TSurveyElementTypeEnum.ContactInfo, TSurveyElementTypeEnum.Address]);

const CONTACT_FIELD_KEYS = ["firstName", "lastName", "email", "phone", "company"] as const;
const ADDRESS_FIELD_KEYS = [
  "addressLine1",
  "addressLine2",
  "city",
  "state",
  "zip",
  "country",
] as const;

/**
 * Resolves a prefillFrom source ID to a value from response data.
 *
 * Supports:
 * - Sub-field references: "questionId.firstName" -> extracts from array response
 * - Direct question/hidden field references: "questionId" -> string value
 */
function resolveSource(sourceId: string, responseData: TResponseData): string | undefined {
  if (sourceId.includes(".")) {
    const [baseId, fieldName] = sourceId.split(".", 2);
    const arrayValue = responseData[baseId];
    if (Array.isArray(arrayValue) && fieldName in ALL_COMPOUND_FIELD_INDICES) {
      return arrayValue[ALL_COMPOUND_FIELD_INDICES[fieldName]] || undefined;
    }
    return undefined;
  }

  const value = responseData[sourceId];
  if (typeof value === "string") return value || undefined;
  return undefined;
}

/**
 * Computes pre-fill values for elements based on their `prefillFrom` configuration.
 *
 * Supports:
 * - Compound elements (ContactInfo, Address): per-field prefillFrom on each sub-field
 * - OpenText elements: single prefillFrom on the element itself
 */
export function computeConfiguredPrefill(
  blockElements: TSurveyElement[],
  responseData: TResponseData
): TResponseData {
  const prefill: TResponseData = {};

  for (const element of blockElements) {
    // Handle compound elements (ContactInfo, Address)
    if (COMPOUND_TYPES.has(element.type)) {
      // Skip if this element already has response data
      const existingValue = responseData[element.id];
      if (Array.isArray(existingValue) && existingValue.some((v) => v)) continue;

      const fieldKeys =
        element.type === TSurveyElementTypeEnum.ContactInfo ? CONTACT_FIELD_KEYS : ADDRESS_FIELD_KEYS;

      const prefillArray = new Array(fieldKeys.length).fill("");
      let hasPrefill = false;

      for (let i = 0; i < fieldKeys.length; i++) {
        const fieldConfig = (element as Record<string, any>)[fieldKeys[i]];
        if (!fieldConfig?.prefillFrom) continue;

        const resolved = resolveSource(fieldConfig.prefillFrom, responseData);
        if (resolved) {
          prefillArray[i] = resolved;
          hasPrefill = true;
        }
      }

      if (hasPrefill) {
        prefill[element.id] = prefillArray;
      }
    }

    // Handle OpenText elements
    if (element.type === TSurveyElementTypeEnum.OpenText) {
      const openTextElement = element as Record<string, any>;
      if (!openTextElement.prefillFrom) continue;

      // Skip if already has response data
      const existingValue = responseData[element.id];
      if (existingValue) continue;

      const resolved = resolveSource(openTextElement.prefillFrom, responseData);
      if (resolved) {
        prefill[element.id] = resolved;
      }
    }
  }

  return prefill;
}
