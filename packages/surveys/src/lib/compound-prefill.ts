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
 * Supports both array and object response formats for compound fields.
 */
function resolveSource(sourceId: string, responseData: TResponseData): string | undefined {
  if (sourceId.includes(".")) {
    const [baseId, fieldName] = sourceId.split(".", 2);
    const baseValue = responseData[baseId];

    // Object format (new)
    if (baseValue && typeof baseValue === "object" && !Array.isArray(baseValue)) {
      const val = (baseValue as Record<string, string>)[fieldName];
      return val || undefined;
    }

    // Array format (legacy)
    if (Array.isArray(baseValue) && fieldName in ALL_COMPOUND_FIELD_INDICES) {
      return baseValue[ALL_COMPOUND_FIELD_INDICES[fieldName]] || undefined;
    }
    return undefined;
  }

  const value = responseData[sourceId];
  if (typeof value === "string") return value || undefined;
  return undefined;
}

/**
 * Computes pre-fill values for elements based on their `prefillFrom` configuration.
 */
export function computeConfiguredPrefill(
  blockElements: TSurveyElement[],
  responseData: TResponseData
): TResponseData {
  const prefill: TResponseData = {};

  for (const element of blockElements) {
    // Handle compound elements (ContactInfo, Address)
    if (COMPOUND_TYPES.has(element.type)) {
      const existingValue = responseData[element.id];

      // Skip if already has data (check both formats)
      if (Array.isArray(existingValue) && existingValue.some((v) => v)) continue;
      if (existingValue && typeof existingValue === "object" && !Array.isArray(existingValue)) {
        if (Object.values(existingValue as Record<string, string>).some((v) => v)) continue;
      }

      const isContact = element.type === TSurveyElementTypeEnum.ContactInfo;
      const fieldKeys = isContact ? CONTACT_FIELD_KEYS : ADDRESS_FIELD_KEYS;

      // For ContactInfo, write object format; for Address, keep array format
      if (isContact) {
        const prefillObj: Record<string, string> = {};
        let hasPrefill = false;

        // Built-in fields
        for (const key of fieldKeys) {
          const fieldConfig = (element as Record<string, any>)[key];
          if (!fieldConfig?.prefillFrom) continue;
          const resolved = resolveSource(fieldConfig.prefillFrom, responseData);
          if (resolved) {
            prefillObj[key] = resolved;
            hasPrefill = true;
          }
        }

        // Custom fields
        const customFields = (element as any).customFields ?? [];
        for (const cf of customFields) {
          if (!cf.prefillFrom) continue;
          const resolved = resolveSource(cf.prefillFrom, responseData);
          if (resolved) {
            prefillObj[cf.id] = resolved;
            hasPrefill = true;
          }
        }

        if (hasPrefill) {
          prefill[element.id] = prefillObj;
        }
      } else {
        // Address: keep existing array format
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
    }

    // Handle OpenText elements
    if (element.type === TSurveyElementTypeEnum.OpenText) {
      const openTextElement = element as Record<string, any>;
      if (!openTextElement.prefillFrom) continue;

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
