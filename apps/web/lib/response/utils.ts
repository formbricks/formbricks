import "server-only";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { Prisma } from "@prisma/client";
import {
  TResponse,
  TResponseFilterCriteria,
  TResponseHiddenFieldsFilter,
  TResponseTtc,
  TSurveyContactAttributes,
  TSurveyMetaFieldFilter,
} from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { processResponseData } from "../responses";
import { getTodaysDateTimeFormatted } from "../time";
import { getFormattedDateTimeString } from "../utils/datetime";
import { sanitizeString } from "../utils/strings";

export const calculateTtcTotal = (ttc: TResponseTtc) => {
  const result = { ...ttc };
  result._total = Object.values(result).reduce((acc: number, val: number) => acc + val, 0);

  return result;
};

export const buildWhereClause = (survey: TSurvey, filterCriteria?: TResponseFilterCriteria) => {
  const whereClause: Prisma.ResponseWhereInput[] = [];

  addFinishedFilter(whereClause, filterCriteria);
  addDateRangeFilter(whereClause, filterCriteria);
  addTagsFilter(whereClause, filterCriteria);
  addContactAttributesFilter(whereClause, filterCriteria);
  addMetaFilter(whereClause, filterCriteria);
  addOthersFilter(whereClause, filterCriteria);
  addDataFilter(whereClause, filterCriteria, survey);
  addResponseIdsFilter(whereClause, filterCriteria);

  return { AND: whereClause };
};

const addFinishedFilter = (
  whereClause: Prisma.ResponseWhereInput[],
  filterCriteria?: TResponseFilterCriteria
): void => {
  if (filterCriteria?.finished === undefined) return;

  whereClause.push({
    finished: filterCriteria.finished,
  });
};

const addDateRangeFilter = (
  whereClause: Prisma.ResponseWhereInput[],
  filterCriteria?: TResponseFilterCriteria
): void => {
  if (!filterCriteria?.createdAt) return;

  const createdAt: { lte?: Date; gte?: Date } = {};

  if (filterCriteria.createdAt.max) {
    createdAt.lte = filterCriteria.createdAt.max;
  }

  if (filterCriteria.createdAt.min) {
    createdAt.gte = filterCriteria.createdAt.min;
  }

  whereClause.push({ createdAt });
};

const addTagsFilter = (
  whereClause: Prisma.ResponseWhereInput[],
  filterCriteria?: TResponseFilterCriteria
): void => {
  if (!filterCriteria?.tags) return;

  const tags: Record<string, any>[] = [];

  if (filterCriteria.tags.applied) {
    const appliedTags = filterCriteria.tags.applied.map((name) => ({
      tags: {
        some: {
          tag: {
            name,
          },
        },
      },
    }));
    tags.push(...appliedTags);
  }

  if (filterCriteria.tags.notApplied) {
    const notAppliedTags = {
      tags: {
        every: {
          tag: {
            name: {
              notIn: filterCriteria.tags.notApplied,
            },
          },
        },
      },
    };

    tags.push(notAppliedTags);
  }

  if (tags.length > 0) {
    whereClause.push({
      AND: tags,
    });
  }
};

const addContactAttributesFilter = (
  whereClause: Prisma.ResponseWhereInput[],
  filterCriteria?: TResponseFilterCriteria
): void => {
  if (!filterCriteria?.contactAttributes) return;

  const contactAttributes: Prisma.ResponseWhereInput[] = [];

  Object.entries(filterCriteria.contactAttributes).forEach(([key, val]) => {
    if (val.op === "equals") {
      contactAttributes.push({
        contactAttributes: {
          path: [key],
          equals: val.value,
        },
      });
    } else if (val.op === "notEquals") {
      contactAttributes.push({
        contactAttributes: {
          path: [key],
          not: val.value,
        },
      });
    }
  });

  if (contactAttributes.length > 0) {
    whereClause.push({
      AND: contactAttributes,
    });
  }
};

const addMetaFilter = (
  whereClause: Prisma.ResponseWhereInput[],
  filterCriteria?: TResponseFilterCriteria
): void => {
  if (!filterCriteria?.meta) return;

  const meta: Prisma.ResponseWhereInput[] = [];

  Object.entries(filterCriteria.meta).forEach(([key, val]) => {
    const updatedKey: string[] = ["browser", "os", "device"].includes(key) ? ["userAgent", key] : [key];

    if (val.op === "equals") {
      meta.push({
        meta: {
          path: updatedKey,
          equals: val.value,
        },
      });
    } else if (val.op === "notEquals") {
      meta.push({
        meta: {
          path: updatedKey,
          not: val.value,
        },
      });
    }
  });

  if (meta.length > 0) {
    whereClause.push({
      AND: meta,
    });
  }
};

const addOthersFilter = (
  whereClause: Prisma.ResponseWhereInput[],
  filterCriteria?: TResponseFilterCriteria
): void => {
  if (!filterCriteria?.others) return;

  const others: Prisma.ResponseWhereInput[] = [];

  Object.entries(filterCriteria.others).forEach(([key, val]) => {
    if (val.op === "equals") {
      others.push({
        [key.toLocaleLowerCase()]: val.value,
      });
    } else if (val.op === "notEquals") {
      others.push({
        [key.toLocaleLowerCase()]: {
          not: val.value,
        },
      });
    }
  });

  if (others.length > 0) {
    whereClause.push({
      AND: others,
    });
  }
};

const handleIncludesOneOperation = (
  key: string,
  val: { value: any[] },
  question: any,
  data: Prisma.ResponseWhereInput[]
): void => {
  const values: string[] = val.value.map((v) => v.toString());
  const otherChoice =
    question && (question.type === "multipleChoiceMulti" || question.type === "multipleChoiceSingle")
      ? question.choices.find((choice: any) => choice.id === "other")
      : null;

  const hasOtherChoice =
    question &&
    (question.type === "multipleChoiceMulti" || question.type === "multipleChoiceSingle") &&
    question.choices.map((choice: any) => choice.id).includes("other") &&
    otherChoice &&
    values.includes(otherChoice.label.default);

  if (hasOtherChoice) {
    const predefinedLabels: string[] = [];

    question.choices.forEach((choice: any) => {
      Object.values(choice.label).forEach((label: any) => {
        if (typeof label === "string" && !values.includes(label)) {
          predefinedLabels.push(label);
        }
      });
    });

    const subsets = generateAllPermutationsOfSubsets(predefinedLabels);

    if (question.type === "multipleChoiceMulti") {
      const subsetConditions = subsets.map((subset) => ({
        data: { path: [key], equals: subset },
      }));
      data.push({
        NOT: {
          OR: subsetConditions,
        },
      });
    } else {
      // for MultipleChoiceSingle
      data.push({
        AND: predefinedLabels.map((label) => ({
          NOT: {
            data: {
              path: [key],
              equals: label,
            },
          },
        })),
      });
    }
  } else {
    data.push({
      OR: val.value.map((value: string | number) => ({
        OR: [
          // for MultipleChoiceMulti
          {
            data: {
              path: [key],
              array_contains: [value],
            },
          },
          // for MultipleChoiceSingle
          {
            data: {
              path: [key],
              equals: value,
            },
          },
        ],
      })),
    });
  }
};

const handleDataOperations = (
  key: string,
  val: { op: string; value?: any },
  question: any,
  data: Prisma.ResponseWhereInput[]
): void => {
  switch (val.op) {
    case "submitted":
      data.push({
        data: {
          path: [key],
          not: Prisma.DbNull,
        },
      });
      break;

    case "filledOut":
      data.push({
        data: {
          path: [key],
          not: [],
        },
      });
      break;

    case "skipped": {
      data.push({
        OR: [
          {
            data: {
              path: [key],
              equals: Prisma.DbNull,
            },
          },
          {
            data: {
              path: [key],
              equals: "",
            },
          },
          // For address question
          {
            data: {
              path: [key],
              equals: [],
            },
          },
        ],
      });
      break;
    }

    case "equals":
      data.push({
        data: {
          path: [key],
          equals: val.value,
        },
      });
      break;

    case "notEquals":
      data.push({
        OR: [
          {
            // for value not equal to val.value
            data: {
              path: [key],
              not: val.value,
            },
          },
          {
            // for not answered
            data: {
              path: [key],
              equals: Prisma.DbNull,
            },
          },
        ],
      });
      break;

    case "lessThan":
      data.push({
        data: {
          path: [key],
          lt: val.value,
        },
      });
      break;

    case "lessEqual":
      data.push({
        data: {
          path: [key],
          lte: val.value,
        },
      });
      break;

    case "greaterThan":
      data.push({
        data: {
          path: [key],
          gt: val.value,
        },
      });
      break;

    case "greaterEqual":
      data.push({
        data: {
          path: [key],
          gte: val.value,
        },
      });
      break;

    case "includesAll":
      data.push({
        data: {
          path: [key],
          array_contains: val.value,
        },
      });
      break;

    case "includesOne":
      handleIncludesOneOperation(key, val as { value: any[] }, question, data);
      break;

    case "uploaded":
      data.push({
        data: {
          path: [key],
          not: "skipped",
        },
      });
      break;

    case "notUploaded":
      data.push({
        OR: [
          {
            // for skipped
            data: {
              path: [key],
              equals: "skipped",
            },
          },
          {
            // for not answered
            data: {
              path: [key],
              equals: Prisma.DbNull,
            },
          },
        ],
      });
      break;

    case "clicked":
      data.push({
        data: {
          path: [key],
          equals: "clicked",
        },
      });
      break;

    case "accepted":
      data.push({
        data: {
          path: [key],
          equals: "accepted",
        },
      });
      break;

    case "booked":
      data.push({
        data: {
          path: [key],
          equals: "booked",
        },
      });
      break;

    case "matrix": {
      const rowLabel = Object.keys(val.value)[0];
      data.push({
        data: {
          path: [key, rowLabel],
          equals: val.value[rowLabel],
        },
      });
      break;
    }
  }
};

const addDataFilter = (
  whereClause: Prisma.ResponseWhereInput[],
  filterCriteria?: TResponseFilterCriteria,
  survey?: TSurvey
): void => {
  if (!filterCriteria?.data || !survey) return;

  const data: Prisma.ResponseWhereInput[] = [];

  Object.entries(filterCriteria.data).forEach(([key, val]) => {
    const question = survey.questions.find((question) => question.id === key);
    handleDataOperations(key, val, question, data);
  });

  if (data.length > 0) {
    whereClause.push({
      AND: data,
    });
  }
};

const addResponseIdsFilter = (
  whereClause: Prisma.ResponseWhereInput[],
  filterCriteria?: TResponseFilterCriteria
): void => {
  if (!filterCriteria?.responseIds) return;

  whereClause.push({
    id: { in: filterCriteria.responseIds },
  });
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
  const questions = survey.questions.map((question, idx) => {
    const headline = getLocalizedValue(question.headline, "default") ?? question.id;
    if (question.type === "matrix") {
      return question.rows.map((row) => {
        return `${idx + 1}. ${headline} - ${getLocalizedValue(row, "default")}`;
      });
    } else {
      return [`${idx + 1}. ${headline}`];
    }
  });
  const hiddenFields = survey.hiddenFields?.fieldIds || [];
  const userAttributes =
    survey.type === "app"
      ? Array.from(new Set(responses.map((response) => Object.keys(response.contactAttributes ?? {})).flat()))
      : [];
  const variables = survey.variables?.map((variable) => variable.name) || [];

  return { metaDataFields, questions, hiddenFields, variables, userAttributes };
};

export const getResponsesJson = (
  survey: TSurvey,
  responses: TResponse[],
  questionsHeadlines: string[][],
  userAttributes: string[],
  hiddenFields: string[]
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
      Notes: response.notes.map((note) => `${note.user.name}: ${note.text}`).join("\n"),
      Tags: response.tags.map((tag) => tag.name).join(", "),
    });

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
    questionsHeadlines.forEach((questionHeadline) => {
      const questionIndex = parseInt(questionHeadline[0]) - 1;
      const question = survey?.questions[questionIndex];
      const answer = response.data[question.id];

      if (question.type === "matrix") {
        // For matrix questions, we need to handle each row separately
        questionHeadline.forEach((headline, index) => {
          if (answer) {
            const row = question.rows[index];
            if (row && row.default && answer[row.default] !== undefined) {
              jsonData[idx][headline] = answer[row.default];
            } else {
              jsonData[idx][headline] = "";
            }
          }
        });
      } else {
        jsonData[idx][questionHeadline[0]] = processResponseData(answer);
      }
    });

    survey.variables?.forEach((variable) => {
      const answer = response.variables[variable.id];
      jsonData[idx][variable.name] = answer;
    });

    // user attributes
    userAttributes.forEach((attribute) => {
      jsonData[idx][attribute] = response.contactAttributes?.[attribute] || "";
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
        // skip url
        if (key === "url") return;

        // Handling nested objects (like userAgent)
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

const generateAllPermutationsOfSubsets = (array: string[]): string[][] => {
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
