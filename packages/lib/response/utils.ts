import "server-only";
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
import { getLocalizedValue } from "../i18n/utils";
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
  const whereClause: Prisma.ResponseWhereInput["AND"] = [];

  // For finished
  if (filterCriteria?.finished !== undefined) {
    whereClause.push({
      finished: filterCriteria?.finished,
    });
  }

  // For Date range
  if (filterCriteria?.createdAt) {
    const createdAt: { lte?: Date; gte?: Date } = {};
    if (filterCriteria?.createdAt?.max) {
      createdAt.lte = filterCriteria?.createdAt?.max;
    }
    if (filterCriteria?.createdAt?.min) {
      createdAt.gte = filterCriteria?.createdAt?.min;
    }

    whereClause.push({
      createdAt,
    });
  }

  // For Tags
  if (filterCriteria?.tags) {
    const tags: Record<string, any>[] = [];

    if (filterCriteria?.tags?.applied) {
      const appliedTags = filterCriteria.tags.applied.map((name) => ({
        tags: {
          some: {
            tag: {
              name,
            },
          },
        },
      }));
      tags.push(appliedTags);
    }

    if (filterCriteria?.tags?.notApplied) {
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

    whereClause.push({
      AND: tags.flat(),
    });
  }

  // For Person Attributes
  if (filterCriteria?.contactAttributes) {
    const contactAttributes: Prisma.ResponseWhereInput[] = [];

    Object.entries(filterCriteria.contactAttributes).forEach(([key, val]) => {
      switch (val.op) {
        case "equals":
          contactAttributes.push({
            contactAttributes: {
              path: [key],
              equals: val.value,
            },
          });
          break;
        case "notEquals":
          contactAttributes.push({
            contactAttributes: {
              path: [key],
              not: val.value,
            },
          });
          break;
      }
    });

    whereClause.push({
      AND: contactAttributes,
    });
  }

  // for meta
  if (filterCriteria?.meta) {
    const meta: Prisma.ResponseWhereInput[] = [];

    Object.entries(filterCriteria.meta).forEach(([key, val]) => {
      let updatedKey: string[] = [];
      if (["browser", "os", "device"].includes(key)) {
        updatedKey = ["userAgent", key];
      } else {
        updatedKey = [key];
      }

      switch (val.op) {
        case "equals":
          meta.push({
            meta: {
              path: updatedKey,
              equals: val.value,
            },
          });
          break;
        case "notEquals":
          meta.push({
            meta: {
              path: updatedKey,
              not: val.value,
            },
          });
          break;
      }
    });

    whereClause.push({
      AND: meta,
    });
  }

  // For Language
  if (filterCriteria?.others) {
    const others: Prisma.ResponseWhereInput[] = [];

    Object.entries(filterCriteria.others).forEach(([key, val]) => {
      switch (val.op) {
        case "equals":
          others.push({
            [key.toLocaleLowerCase()]: val.value,
          });
          break;
        case "notEquals":
          others.push({
            [key.toLocaleLowerCase()]: {
              not: val.value,
            },
          });
          break;
      }
    });
    whereClause.push({
      AND: others,
    });
  }

  // For Questions Data
  if (filterCriteria?.data) {
    const data: Prisma.ResponseWhereInput[] = [];

    Object.entries(filterCriteria.data).forEach(([key, val]) => {
      const question = survey.questions.find((question) => question.id === key);

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
        case "skipped":
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
          // * If the question includes an 'other' choice and the user has selected it:
          // *   - `predefinedLabels`: Collects labels from the question's choices that aren't selected by the user.
          // *   - `subsets`: Generates all possible non-empty permutations of subsets of these predefined labels.
          // *
          // * Depending on the question type (multiple or single choice), the filter is constructed:
          // *   - For "multipleChoiceMulti": Filters out any combinations of choices that match the subsets of predefined labels.
          // *   - For "multipleChoiceSingle": Filters out any single predefined labels that match the user's selection.
          const values: string[] = val.value.map((v) => v.toString());
          const otherChoice =
            question && (question.type === "multipleChoiceMulti" || question.type === "multipleChoiceSingle")
              ? question.choices.find((choice) => choice.id === "other")
              : null;

          if (
            question &&
            (question.type === "multipleChoiceMulti" || question.type === "multipleChoiceSingle") &&
            question.choices.map((choice) => choice.id).includes("other") &&
            otherChoice &&
            values.includes(otherChoice.label.default)
          ) {
            const predefinedLabels: string[] = [];

            question.choices.forEach((choice) => {
              Object.values(choice.label).forEach((label) => {
                if (!values.includes(label)) {
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
              data.push(
                // for MultipleChoiceSingle
                {
                  AND: predefinedLabels.map((label) => ({
                    NOT: {
                      data: {
                        path: [key],
                        equals: label,
                      },
                    },
                  })),
                }
              );
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
        case "matrix":
          const rowLabel = Object.keys(val.value)[0];
          data.push({
            data: {
              path: [key, rowLabel],
              equals: val.value[rowLabel],
            },
          });
          break;
      }
    });

    whereClause.push({
      AND: data,
    });
  }
  return { AND: whereClause };
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
