import "server-only";

import { Prisma } from "@prisma/client";

import {
  TResponse,
  TResponseFilterCriteria,
  TResponseTtc,
  TSurveySummary,
} from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys";

import { getTodaysDateTimeFormatted } from "../time";
import { evaluateCondition } from "../utils/evaluateLogic";

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
                  equals: "dismissed",
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
  const userAttributes = Array.from(
    new Set(responses.map((response) => Object.keys(response.personAttributes ?? {})).flat())
  );

  return { metaDataFields, questions, hiddenFields, userAttributes };
};

export const getResponsesJson = (
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

export const getSurveySummaryMeta = (
  responses: TResponse[],
  displayCount: number
): TSurveySummary["meta"] => {
  const completedResponses = responses.filter((response) => response.finished).length;

  let ttcResponseCount = 0;
  const ttcSum = responses.reduce((acc, response) => {
    if (response.ttc?._total) {
      ttcResponseCount++;
      return acc + response.ttc._total;
    }
    return acc;
  }, 0);
  const responseCount = responses.length;

  const startsPercentage = displayCount > 0 ? (responseCount / displayCount) * 100 : 0;
  const completedPercentage = displayCount > 0 ? (completedResponses / displayCount) * 100 : 0;
  const dropoffs = responseCount - completedResponses;
  const dropoffRate = responseCount > 0 ? (dropoffs / responseCount) * 100 : 0;
  const ttcAverage = ttcResponseCount > 0 ? ttcSum / ttcResponseCount : 0;

  return {
    displayCount,
    totalResponses: responseCount,
    startsPercentage,
    completedResponses,
    completedPercentage,
    dropoffs,
    dropoffRate,
    ttcAverage,
  };
};

export const getSurveySummaryDropoff = (
  survey: TSurvey,
  responses: TResponse[],
  displayCount: number
): TSurveySummary["dropoff"] => {
  const initialTtc = survey.questions.reduce((acc: Record<string, number>, question) => {
    acc[question.id] = 0;
    return acc;
  }, {});

  let totalTtc = { ...initialTtc };
  let responseCounts = { ...initialTtc };

  let dropoffArr = new Array(survey.questions.length).fill(0) as number[];
  let viewsArr = new Array(survey.questions.length).fill(0) as number[];
  let dropoffPercentageArr = new Array(survey.questions.length).fill(0) as number[];

  responses.forEach((response) => {
    // Calculate total time-to-completion
    Object.keys(totalTtc).forEach((questionId) => {
      if (response.ttc && response.ttc[questionId]) {
        totalTtc[questionId] += response.ttc[questionId];
        responseCounts[questionId]++;
      }
    });

    let currQuesIdx = 0;

    while (currQuesIdx < survey.questions.length) {
      const currQues = survey.questions[currQuesIdx];
      if (!currQues) break;

      if (!currQues.required) {
        if (!response.data[currQues.id]) {
          viewsArr[currQuesIdx]++;

          if (currQuesIdx === survey.questions.length - 1 && !response.finished) {
            dropoffArr[currQuesIdx]++;
            break;
          }

          const questionHasCustomLogic = currQues.logic;
          if (questionHasCustomLogic) {
            let didLogicPass = false;
            for (let logic of questionHasCustomLogic) {
              if (!logic.destination) continue;
              if (evaluateCondition(logic, response.data[currQues.id] ?? null)) {
                didLogicPass = true;
                currQuesIdx = survey.questions.findIndex((q) => q.id === logic.destination);
                break;
              }
            }
            if (!didLogicPass) currQuesIdx++;
          } else {
            currQuesIdx++;
          }
          continue;
        }
      }

      if (
        (response.data[currQues.id] === undefined && !response.finished) ||
        (currQues.required && !response.data[currQues.id])
      ) {
        dropoffArr[currQuesIdx]++;
        viewsArr[currQuesIdx]++;
        break;
      }

      viewsArr[currQuesIdx]++;

      let nextQuesIdx = currQuesIdx + 1;
      const questionHasCustomLogic = currQues.logic;

      if (questionHasCustomLogic) {
        for (let logic of questionHasCustomLogic) {
          if (!logic.destination) continue;
          if (evaluateCondition(logic, response.data[currQues.id])) {
            nextQuesIdx = survey.questions.findIndex((q) => q.id === logic.destination);
            break;
          }
        }
      }

      if (!response.data[survey.questions[nextQuesIdx]?.id] && !response.finished) {
        dropoffArr[nextQuesIdx]++;
        viewsArr[nextQuesIdx]++;
        break;
      }

      currQuesIdx = nextQuesIdx;
    }
  });

  // Calculate the average time for each question
  Object.keys(totalTtc).forEach((questionId) => {
    totalTtc[questionId] =
      responseCounts[questionId] > 0 ? totalTtc[questionId] / responseCounts[questionId] : 0;
  });

  if (!survey.welcomeCard.enabled) {
    dropoffArr[0] = displayCount - viewsArr[0];
    if (viewsArr[0] > displayCount) dropoffPercentageArr[0] = 0;

    dropoffPercentageArr[0] =
      viewsArr[0] - displayCount >= 0 ? 0 : ((displayCount - viewsArr[0]) / displayCount) * 100 || 0;

    viewsArr[0] = displayCount;
  } else {
    dropoffPercentageArr[0] = (dropoffArr[0] / viewsArr[0]) * 100;
  }

  for (let i = 1; i < survey.questions.length; i++) {
    if (viewsArr[i] !== 0) {
      dropoffPercentageArr[i] = (dropoffArr[i] / viewsArr[i]) * 100;
    }
  }

  const dropoff = survey.questions.map((question, index) => {
    return {
      questionId: question.id,
      headline: question.headline,
      ttc: totalTtc[question.id],
      views: viewsArr[index],
      dropoffCount: dropoffArr[index],
      dropoffPercentage: dropoffPercentageArr[index],
    };
  });

  return dropoff;
};
