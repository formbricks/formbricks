import {
  TResponse,
  TResponseDataValue,
  TResponseHiddenFieldsFilter,
  TResponseTtc,
  TResponseWithQuotas,
  TSurveyContactAttributes,
  TSurveyMetaFieldFilter,
} from "@formbricks/types/responses";
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

export const extracMetadataKeys = (obj: TResponse["meta"]) => {
  let keys: string[] = [];

  Object.entries(obj ?? {}).forEach(([key, value]) => {
    if (typeof value === "object" && value !== null) {
      Object.entries(value).forEach(([subKey]) => {
        keys.push(key + " - " + subKey);
      });
    } else {
      keys.push(key);
    }
  });

  return keys;
};

export const extractSurveyDetails = (survey: TSurvey, responses: TResponse[]) => {
  const metaDataFields = responses.length > 0 ? extracMetadataKeys(responses[0].meta) : [];
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

  const hiddenFields = survey.hiddenFields?.fieldIds || [];
  const userAttributes = Array.from(
    new Set(responses.map((response) => Object.keys(response.contactAttributes ?? {})).flat())
  );
  const variables = survey.variables?.map((variable) => variable.name) || [];

  return { metaDataFields, elements, hiddenFields, variables, userAttributes };
};

export const getResponsesJson = (
  survey: TSurvey,
  responses: TResponseWithQuotas[],
  elementsHeadlines: string[][],
  userAttributes: string[],
  hiddenFields: string[],
  isQuotasAllowed: boolean = false
): Record<string, string | number>[] => {
  const jsonData: Record<string, string | number>[] = [];

  responses.forEach((response, idx) => {
    // basic response details
    jsonData.push({
      "No.": idx + 1,
      "Response ID": response.id,
      Timestamp: getFormattedDateTimeString(response.createdAt),
      Finished: response.finished ? "Yes" : "No",
      "Survey ID": response.surveyId,
      "Formbricks ID (internal)": response.contact?.id || "",
      "User ID": response.contact?.userId || "",
      Tags: response.tags.map((tag) => tag.name).join(", "),
    });

    if (isQuotasAllowed) {
      jsonData[idx]["Quotas"] = response.quotas?.map((quota) => quota.name).join(", ") || "";
    }

    // meta details
    Object.entries(response.meta ?? {}).forEach(([key, value]) => {
      if (typeof value === "object" && value !== null) {
        Object.entries(value).forEach(([subKey, subValue]) => {
          jsonData[idx][key + " - " + subKey] = subValue;
        });
      } else {
        jsonData[idx][key] = value;
      }
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

    survey.variables?.forEach((variable) => {
      const answer = response.variables[variable.id];
      jsonData[idx][variable.name] = answer;
    });

    userAttributes.forEach((attribute) => {
      jsonData[idx][`person.${attribute}`] = response.contactAttributes?.[attribute] || "";
    });

    // hidden fields
    hiddenFields.forEach((field) => {
      const value = response.data[field];
      if (Array.isArray(value)) {
        jsonData[idx][field] = value.join("; ");
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

    const surveyHiddenFields = survey?.hiddenFields.fieldIds;
    const hasHiddenFields = surveyHiddenFields && surveyHiddenFields.length > 0;

    if (hasHiddenFields) {
      // adding hidden fields to meta
      survey?.hiddenFields.fieldIds?.forEach((fieldId) => {
        hiddenFields[fieldId] = new Set();
      });

      responses.forEach((response) => {
        // Handling data fields(Hidden fields)
        surveyHiddenFields?.forEach((fieldId) => {
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
