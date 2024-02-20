import "server-only";

import { Prisma } from "@prisma/client";

import { TResponse, TResponseFilterCriteria, TResponseTtc } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys";

import { getTodaysDateTimeFormatted } from "../time";

export function calculateTtcTotal(ttc: TResponseTtc) {
  const result = { ...ttc };
  result._total = Object.values(result).reduce((acc: number, val: number) => acc + val, 0);

  return result;
}

export const buildWhereClause = (filterCriteria?: TResponseFilterCriteria) => {
  const whereClause: Record<string, any>[] = [];

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
  if (filterCriteria?.personAttributes) {
    const personAttributes: Prisma.ResponseWhereInput[] = [];

    Object.entries(filterCriteria.personAttributes).forEach(([key, val]) => {
      switch (val.op) {
        case "equals":
          personAttributes.push({
            personAttributes: {
              path: [key],
              equals: val.value,
            },
          });
          break;
        case "notEquals":
          personAttributes.push({
            personAttributes: {
              path: [key],
              not: val.value,
            },
          });
          break;
      }
    });

    whereClause.push({
      AND: personAttributes,
    });
  }

  // For Questions Data
  if (filterCriteria?.data) {
    const data: Prisma.ResponseWhereInput[] = [];

    Object.entries(filterCriteria.data).forEach(([key, val]) => {
      switch (val.op) {
        case "submitted":
          data.push({
            data: {
              path: [key],
              not: Prisma.DbNull,
            },
          });
          break;
        case "skipped": // need to handle dismissed case for CTA type question, that would hinder other ques(eg open text)
          data.push({
            data: {
              path: [key],
              equals: Prisma.DbNull,
            },
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
          data.push({
            OR: val.value.map((value: string) => ({
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
      }
    });

    whereClause.push({
      AND: data,
    });
  }

  return { AND: whereClause };
};

export const getResponsesFileName = (surveyName: string, extension: string) => {
  const formattedDateString = getTodaysDateTimeFormatted("-");
  return `export-${surveyName.split(" ").join("-")}-${formattedDateString}.${extension}`.toLocaleLowerCase();
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
  const metaDataFields = extracMetadataKeys(responses[0].meta);
  const questions = survey.questions.map((question, idx) => `${idx + 1}. ${question.headline}`);
  const hiddenFields = survey.hiddenFields?.fieldIds || [];
  let userAttributes: string[] = [];

  if (survey.type === "web") {
    // extracting unique user attributes from responses
    userAttributes = Array.from(
      new Set(responses.map((response) => Object.keys(response.personAttributes ?? {})).flat())
    );
  }

  return { metaDataFields, questions, hiddenFields, userAttributes };
};

export const getResponsesJSON = (
  survey: TSurvey,
  responses: TResponse[],
  questions: string[],
  userAttributes: string[],
  hiddenFields: string[]
): Record<string, string | number>[] => {
  const jsonData: Record<string, string | number>[] = [];

  responses.forEach((response, idx) => {
    // basic response details
    jsonData.push({
      "No.": idx + 1,
      "Response ID": response.id,
      Timestamp: response.createdAt.toDateString(),
      Finished: response.finished ? "Yes" : "No",
      "Survey ID": response.surveyId,
      "User ID": response.person?.userId || "",
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
    questions.forEach((question, i) => {
      const questionId = survey?.questions[i].id || "";
      const answer = response.data[questionId];
      jsonData[idx][question] = Array.isArray(answer) ? answer.join("; ") : answer;
    });

    // user attributes
    userAttributes.forEach((attribute) => {
      jsonData[idx][attribute] = response.personAttributes?.[attribute] || "";
    });

    // hidden fields
    hiddenFields.forEach((field) => {
      const value = response.data[field];
      if (Array.isArray(value)) {
        jsonData[idx][field] = value.join("; ");
      } else {
        jsonData[idx][field] = value;
      }
    });
  });

  return jsonData;
};
