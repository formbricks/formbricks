import { normalizeLanguageCode } from "@formbricks/i18n-utils/src/canonical";
import {
  RESERVED_FIELD_CATALOG,
  type TEmbeddedValueResponse,
  type TReservedFieldCatalogEntry,
  dropShadowedReservedEntries,
  getComputedEmbeddedFields,
  getIngestedStorageKeys,
  getSurveyEmbeddedFields,
  listShadowingNames,
  projectReservedValues,
} from "@formbricks/types/embedded-data-resolver";
import {
  TResponse,
  TResponseDataValue,
  TResponseHiddenFieldsFilter,
  TResponseTtc,
  TResponseWithQuotas,
  TSurveyContactAttributes,
  TSurveyMetaFieldFilter,
} from "@formbricks/types/responses";
import { formatFieldNameToTitleCase } from "@formbricks/types/safe-identifier";
import {
  TSurveyElement,
  TSurveyMultipleChoiceElement,
  TSurveyPictureSelectionElement,
  TSurveyRankingElement,
} from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { replaceHeadlineRecall } from "@/lib/utils/recall";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import { processResponseData } from "../responses";
import { getTodaysDateTimeFormatted } from "../time";
import { getFormattedDateTimeString } from "../utils/datetime";
import { sanitizeString } from "../utils/strings";

/**
 * Extracts choice IDs from response values for multiple choice elements
 * @param responseValue - The response value (string for single choice, array for multi choice)
 * @param element - The survey element containing choices
 * @param language - The language to match against (defaults to "default")
 * @returns Array of choice IDs
 */
export const extractChoiceIdsFromResponse = (
  responseValue: TResponseDataValue,
  element: TSurveyElement,
  language: string = "default"
): string[] => {
  if (
    element.type !== "multipleChoiceMulti" &&
    element.type !== "multipleChoiceSingle" &&
    element.type !== "ranking" &&
    element.type !== "pictureSelection"
  ) {
    return [];
  }

  const isPictureSelection = element.type === "pictureSelection";

  if (!responseValue) {
    return [];
  }

  // For picture selection elements, the response value is already choice ID(s)
  if (isPictureSelection) {
    if (Array.isArray(responseValue)) {
      // Multi-selection: array of choice IDs
      return responseValue.filter((id): id is string => typeof id === "string");
    } else if (typeof responseValue === "string") {
      // Single selection: single choice ID
      return [responseValue];
    }
    return [];
  }

  const defaultLanguage = language ?? "default";

  // Helper function to find choice by label - eliminates duplication
  const findChoiceByLabel = (choiceLabel: string): string | null => {
    const targetChoice = element.choices.find((c) => {
      // Try exact language match first
      if (c.label[defaultLanguage] === choiceLabel) {
        return true;
      }
      // Fall back to checking all language values
      return Object.values(c.label).includes(choiceLabel);
    });
    return targetChoice?.id || "other";
  };

  if (Array.isArray(responseValue)) {
    // Multiple choice case - response is an array of selected choice labels
    // Filter out empty string sentinel used as "other" marker in multipleChoiceMulti
    return responseValue
      .filter((v) => v !== "")
      .map(findChoiceByLabel)
      .filter((choiceId): choiceId is string => choiceId !== null);
  } else if (typeof responseValue === "string") {
    // Single choice case - response is a single choice label
    const choiceId = findChoiceByLabel(responseValue);
    return choiceId ? [choiceId] : [];
  }

  return [];
};

export const getChoiceIdByValue = (
  value: string,
  element: TSurveyMultipleChoiceElement | TSurveyRankingElement | TSurveyPictureSelectionElement
) => {
  if (element.type === "pictureSelection") {
    return element.choices.find((choice) => choice.imageUrl === value)?.id ?? "other";
  }

  return element.choices.find((choice) => choice.label.default === value)?.id ?? "other";
};

export const calculateTtcTotal = (ttc: TResponseTtc) => {
  const result = { ...ttc };
  result._total = Object.values(result).reduce((acc: number, val: number) => acc + val, 0);

  return result;
};

export const getResponsesFileName = (surveyName: string, extension: string) => {
  const sanitizedSurveyName = sanitizeString(surveyName);

  const formattedDateString = getTodaysDateTimeFormatted("-");
  return `export-${sanitizedSurveyName.split(" ").join("-")}-${formattedDateString}.${extension}`.toLocaleLowerCase();
};

/**
 * The four catalog entries whose values the export's fixed basic columns already carry — "Response
 * ID", "Survey ID", "Finished" and "Timestamp" (`createdAt`, which is what `startedAt` reads).
 * Skipped from the reserved column set so one fact never gets two columns.
 */
const EXPORT_BASICS_COVERED_RESERVED_NAMES = new Set(["responseId", "surveyId", "finished", "startedAt"]);

/**
 * The reserved fields one survey's export carries as columns — the catalog, minus what cannot or
 * must not appear (ENG-1847).
 *
 * Catalog-derived on purpose: the previous column set was the FIRST response's `meta` keys, so a
 * first response missing `utmSource` meant no column at all, however many later responses carried
 * it — and headers came out as raw key paths (`userAgent - browser`). This set is stable per
 * survey, whatever any individual response holds.
 *
 * The filters, each a decision already made elsewhere and reused here:
 * - shadowed entries drop (`dropShadowedReservedEntries`) — a survey declaring `url` keeps its
 *   declared column and never gets the reserved one, same rule as the renderer and response table;
 * - the four facts the fixed basic columns already carry are skipped (one column per fact);
 * - on an anonymized survey, `privacy: "drop"` entries are never captured, so their always-empty
 *   columns are omitted;
 * - `ipAddress` is only a column when the survey captures it (`isCaptureIpEnabled`).
 */
/**
 * The gates every reserved-entry consumer shares: shadowed entries drop (a declared field owns its
 * name), anonymized surveys drop `privacy: "drop"` entries (never captured), and `ipAddress` needs
 * its capture toggle. What differs per surface is only which entries are eligible at all.
 */
const gateReservedEntries = (
  survey: TSurvey,
  isEligible: (entry: TReservedFieldCatalogEntry) => boolean
): TReservedFieldCatalogEntry[] => {
  const elementIds = getElementsFromBlocks(survey.blocks).map((element) => element.id);
  const shadowingNames = listShadowingNames(getSurveyEmbeddedFields(survey), elementIds);

  return dropShadowedReservedEntries(RESERVED_FIELD_CATALOG, shadowingNames).filter((entry) => {
    if (!isEligible(entry)) return false;
    if (survey.isAnonymizeResponsesEnabled && entry.privacy === "drop") return false;
    if (entry.name === "ipAddress" && !survey.isCaptureIpEnabled) return false;
    return true;
  });
};

export const getReservedExportEntries = (survey: TSurvey): TReservedFieldCatalogEntry[] =>
  gateReservedEntries(survey, (entry) => !EXPORT_BASICS_COVERED_RESERVED_NAMES.has(entry.name));

/**
 * The export header for a reserved column. `formatFieldNameToTitleCase` rather than the localized
 * `getReservedFieldLabel`: export headers are a machine-facing contract, and localizing them would
 * make the column names depend on whichever operator happened to click download.
 */
export const getReservedExportHeader = (entry: TReservedFieldCatalogEntry): string =>
  formatFieldNameToTitleCase(entry.name);

/**
 * The reserved fields one survey's response filter may offer (ENG-1848) — the same list the
 * response table shows (`display !== "none"`), plus `durationSeconds`, whose `ttc._total` path the
 * ticket names explicitly even though the table hides it. The gates:
 * - shadowed entries drop — filters fail closed on a name the survey's declared fields own
 *   (`buildWhereClause` enforces the same rule server-side against crafted criteria);
 * - on an anonymized survey, `privacy: "drop"` entries are never captured, and `ipAddress` is only
 *   captured when `isCaptureIpEnabled` — offering either would let users build always-empty filters.
 */
export const getReservedFilterEntries = (survey: TSurvey): TReservedFieldCatalogEntry[] =>
  gateReservedEntries(survey, (entry) => entry.display !== "none" || entry.name === "durationSeconds");

/**
 * Upper bound on distinct dropdown options collected per field. Free-text fields like `url` or
 * `pageReferrer` are unbounded in practice, and the whole record ships to the client when the
 * filter opens; past this many options a dropdown is no better than the free-text input anyway.
 */
const MAX_FILTER_VALUE_OPTIONS = 50;

const addBoundedValue = (values: Record<string, Set<string>>, key: string, value: string): void => {
  values[key] ??= new Set();
  if (values[key].size >= MAX_FILTER_VALUE_OPTIONS) return;
  values[key].add(value);
};

/**
 * Observed values for the string-typed reserved filter fields, through the shared projection — so
 * `redactQuery` entries (url, pageReferrer) never leak query strings into the filter dropdown.
 * Number-typed entries are skipped: they get a numeric input, not an options list.
 */
export const getResponseReservedFilterValues = (
  survey: TSurvey,
  responses: TEmbeddedValueResponse[]
): TSurveyMetaFieldFilter => {
  const entries = getReservedFilterEntries(survey).filter((entry) => entry.dataType === "string");
  const values: Record<string, Set<string>> = {};

  responses.forEach((response) => {
    const projected = projectReservedValues(entries, response);
    entries.forEach((entry) => {
      const value = projected[entry.name];
      if (typeof value !== "string" || value.length === 0) return;
      addBoundedValue(values, entry.name, value);
    });
  });

  return Object.fromEntries(Object.entries(values).map(([name, set]) => [name, Array.from(set)]));
};

/** Observed values for string-typed computed embedded fields, keyed by storageKey (ENG-1848). */
export const getResponseVariableFilterValues = (
  survey: TSurvey,
  responses: Pick<TResponse, "variables">[]
): TSurveyMetaFieldFilter => {
  const stringFields = getComputedEmbeddedFields(survey).filter(({ field }) => field.dataType === "string");
  const values: Record<string, Set<string>> = {};

  responses.forEach((response) => {
    stringFields.forEach(({ link }) => {
      const value = response.variables?.[link.storageKey];
      if (typeof value !== "string" || value.length === 0) return;
      addBoundedValue(values, link.storageKey, value);
    });
  });

  return Object.fromEntries(Object.entries(values).map(([key, set]) => [key, Array.from(set)]));
};

export const extractSurveyDetails = (survey: TSurvey, responses: TResponse[]) => {
  const metaDataFields = getReservedExportEntries(survey).map(getReservedExportHeader);
  const modifiedSurvey = replaceHeadlineRecall(survey, "default");

  const modifiedElements = getElementsFromBlocks(modifiedSurvey.blocks);

  const elements = modifiedElements.map((element, idx) => {
    const headline = getTextContent(getLocalizedValue(element.headline, "default")) ?? element.id;
    if (element.type === "matrix") {
      return element.rows.map((row) => {
        return `${idx + 1}. ${headline} - ${getTextContent(getLocalizedValue(row.label, "default"))}`;
      });
    } else if (
      element.type === "multipleChoiceMulti" ||
      element.type === "multipleChoiceSingle" ||
      element.type === "ranking"
    ) {
      return [`${idx + 1}. ${headline}`, `${idx + 1}. ${headline} - Option ID`];
    } else {
      return [`${idx + 1}. ${headline}`];
    }
  });

  // ENG-1837: the two column groups keep today's shape — computed fields labelled by name, ingested
  // ones by storage key — and today's order, which `inlineSurveyEmbeddedFields` preserves.
  const hiddenFields = getIngestedStorageKeys(survey);
  const userAttributes = Array.from(
    new Set(responses.map((response) => Object.keys(response.contactAttributes ?? {})).flat())
  );
  const variables = getComputedEmbeddedFields(survey).map(({ field }) => field.name);

  return { metaDataFields, elements, hiddenFields, variables, userAttributes };
};

export const getResponsesJson = (
  survey: TSurvey,
  responses: TResponseWithQuotas[],
  elementsHeadlines: string[][],
  userAttributes: string[],
  hiddenFields: string[],
  isQuotasAllowed: boolean = false,
  timeZone: string = "UTC"
): Record<string, string | number>[] => {
  const jsonData: Record<string, string | number>[] = [];
  const reservedEntries = getReservedExportEntries(survey);

  responses.forEach((response, idx) => {
    // basic response details
    jsonData.push({
      "No.": idx + 1,
      "Response ID": response.id,
      Timestamp: getFormattedDateTimeString(response.createdAt, timeZone),
      Finished: response.finished ? "Yes" : "No",
      "Survey ID": response.surveyId,
      "Formbricks ID (internal)": response.contact?.id || "",
      "User ID": response.contact?.userId || "",
      Tags: response.tags.map((tag) => tag.name).join(", "),
    });

    if (isQuotasAllowed) {
      jsonData[idx]["Quotas"] = response.quotas?.map((quota) => quota.name).join(", ") || "";
    }

    // Reserved fields, through the same projection recall/logic read (coercion to the declared
    // dataType, booleans stringified, `redactQuery` honoured). Every column gets a cell — absent
    // values as "" — so rows stay aligned with the stable header set.
    const reservedValues = projectReservedValues(reservedEntries, response);
    reservedEntries.forEach((entry) => {
      jsonData[idx][getReservedExportHeader(entry)] = reservedValues[entry.name] ?? "";
    });

    // survey response data
    elementsHeadlines.forEach((elementHeadline) => {
      const elementIndex = parseInt(elementHeadline[0]) - 1;
      const elements = getElementsFromBlocks(survey.blocks);
      const element = elements[elementIndex];
      const answer = response.data[element.id];

      if (element.type === "matrix") {
        // For matrix elements, we need to handle each row separately
        elementHeadline.forEach((headline, index) => {
          if (answer) {
            const row = element.rows[index];
            if (
              row &&
              row.label.default &&
              (answer as Record<string, string>)[row.label.default] !== undefined
            ) {
              jsonData[idx][headline] = (answer as Record<string, string>)[row.label.default];
            } else {
              jsonData[idx][headline] = "";
            }
          }
        });
      } else if (
        element.type === "multipleChoiceMulti" ||
        element.type === "multipleChoiceSingle" ||
        element.type === "ranking"
      ) {
        // Set the main response value
        jsonData[idx][elementHeadline[0]] = processResponseData(answer);

        // Set the option IDs using the reusable function
        if (elementHeadline[1]) {
          const choiceIds = extractChoiceIdsFromResponse(answer, element, response.language || "default");
          jsonData[idx][elementHeadline[1]] = choiceIds.join(", ");
        }
      } else {
        jsonData[idx][elementHeadline[0]] = processResponseData(answer);
      }
    });

    // The raw slot, uncoerced and with no default substituted: a response written before this field
    // existed has no key, and the cell must stay empty rather than display a value that run never
    // produced. (This is why the export does not read through `resolveEmbeddedValue`.)
    getComputedEmbeddedFields(survey).forEach(({ field, link }) => {
      const answer = response.variables[link.storageKey];
      jsonData[idx][field.name] = answer;
    });

    userAttributes.forEach((attribute) => {
      jsonData[idx][`person.${attribute}`] = response.contactAttributes?.[attribute] || "";
    });

    // hidden fields — a number stays a number (the ingest contract stores coerced values, so a
    // `dataType: "number"` field holds a real number and the XLSX cell should be numeric, not text)
    hiddenFields.forEach((field) => {
      const value = response.data[field];
      if (Array.isArray(value)) {
        jsonData[idx][field] = value.join("; ");
      } else if (typeof value === "number") {
        jsonData[idx][field] = value;
      } else {
        jsonData[idx][field] = processResponseData(value);
      }
    });

    if (survey.isVerifyEmailEnabled) {
      const verifiedEmail = response.data["verifiedEmail"];
      jsonData[idx]["Verified Email"] = processResponseData(verifiedEmail);
    }
  });

  return jsonData;
};

export const getResponseContactAttributes = (
  responses: Pick<TResponse, "contactAttributes" | "data" | "meta">[]
): TSurveyContactAttributes => {
  try {
    let attributes: TSurveyContactAttributes = {};

    responses.forEach((response) => {
      Object.keys(response.contactAttributes ?? {}).forEach((key) => {
        if (response.contactAttributes && attributes[key]) {
          attributes[key].push(response.contactAttributes[key].toString());
        } else if (response.contactAttributes) {
          attributes[key] = [response.contactAttributes[key].toString()];
        }
      });
    });

    Object.keys(attributes).forEach((key) => {
      attributes[key] = Array.from(new Set(attributes[key]));
    });

    return attributes;
  } catch (error) {
    throw error;
  }
};

export const getResponseMeta = (
  responses: Pick<TResponse, "contactAttributes" | "data" | "meta">[]
): TSurveyMetaFieldFilter => {
  try {
    const meta: { [key: string]: Set<string> } = {};

    responses.forEach((response) => {
      Object.entries(response.meta).forEach(([key, value]) => {
        // Handling nested objects (like userAgent)
        if (key === "url") {
          if (!meta[key]) {
            meta[key] = new Set();
          }
          return;
        }
        if (typeof value === "object" && value !== null) {
          Object.entries(value).forEach(([nestedKey, nestedValue]) => {
            if (typeof nestedValue === "string" && nestedValue) {
              if (!meta[nestedKey]) {
                meta[nestedKey] = new Set();
              }
              meta[nestedKey].add(nestedValue);
            }
          });
        } else if (typeof value === "string" && value) {
          if (!meta[key]) {
            meta[key] = new Set();
          }
          meta[key].add(value);
        }
      });
    });

    // Convert Set to Array
    const result = Object.fromEntries(
      Object.entries(meta).map(([key, valueSet]) => [key, Array.from(valueSet)])
    );

    return result;
  } catch (error) {
    throw error;
  }
};

export const getResponseHiddenFields = (
  survey: TSurvey,
  responses: Pick<TResponse, "contactAttributes" | "data" | "meta">[]
): TResponseHiddenFieldsFilter => {
  try {
    const hiddenFields: { [key: string]: Set<string> } = {};

    const surveyHiddenFields = getIngestedStorageKeys(survey);
    const hasHiddenFields = surveyHiddenFields.length > 0;

    if (hasHiddenFields) {
      // adding hidden fields to meta
      surveyHiddenFields.forEach((fieldId) => {
        hiddenFields[fieldId] = new Set();
      });

      responses.forEach((response) => {
        // Handling data fields(Hidden fields)
        surveyHiddenFields.forEach((fieldId) => {
          const hiddenFieldValue = response.data[fieldId];
          if (hiddenFieldValue) {
            if (typeof hiddenFieldValue === "string") {
              hiddenFields[fieldId].add(hiddenFieldValue);
            }
          }
        });
      });
    }

    // Convert Set to Array
    const result = Object.fromEntries(
      Object.entries(hiddenFields).map(([key, valueSet]) => [key, Array.from(valueSet)])
    );

    return result;
  } catch (error) {
    throw error;
  }
};

export const generateAllPermutationsOfSubsets = (array: string[]): string[][] => {
  const subsets: string[][] = [];

  // Helper function to generate permutations of an array
  const generatePermutations = (arr: string[]): string[][] => {
    const permutations: string[][] = [];

    // Recursive function to generate permutations
    const permute = (current: string[], remaining: string[]): void => {
      if (remaining.length === 0) {
        permutations.push(current.slice()); // Make a copy of the current permutation
        return;
      }

      for (let i = 0; i < remaining.length; i++) {
        current.push(remaining[i]);
        permute(current, remaining.slice(0, i).concat(remaining.slice(i + 1)));
        current.pop();
      }
    };

    permute([], arr);
    return permutations;
  };

  // Recursive function to generate subsets
  const findSubsets = (currentIndex: number, currentSubset: string[]): void => {
    if (currentIndex === array.length) {
      if (currentSubset.length > 0) {
        // Skip empty subset if not needed
        const allPermutations = generatePermutations(currentSubset);
        subsets.push(...allPermutations); // Spread operator to add all permutations individually
      }
      return;
    }

    // Include the current element
    findSubsets(currentIndex + 1, currentSubset.concat(array[currentIndex]));

    // Exclude the current element
    findSubsets(currentIndex + 1, currentSubset);
  };

  findSubsets(0, []);
  return subsets;
};

/**
 * Canonicalize a response's language code on write (ENG-1067). SDK clients — especially stale or
 * anonymous caches — can submit a legacy code (e.g. "hi") at any point; storing its canonical BCP-47
 * form ("hi-IN") keeps the Response table canonical. The "default" sentinel and unresolvable values
 * are preserved (normalizeLanguageCode returns null → keep the trimmed code).
 *
 * `null`/`undefined` pass through unchanged; blank/whitespace-only strings are treated as absent
 * (→ `undefined`) so they're never persisted as an empty `language`.
 */
export const normalizeResponseLanguage = (language: string | null | undefined): string | null | undefined => {
  if (language == null) return language;
  const trimmed = language.trim();
  if (!trimmed) return undefined;
  return normalizeLanguageCode(trimmed) ?? trimmed;
};
