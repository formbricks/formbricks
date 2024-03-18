import "server-only";

import { Prisma } from "@prisma/client";

import { TPerson } from "@formbricks/types/people";
import {
  TResponse,
  TResponseFilterCriteria,
  TResponseTtc,
  TSurveySummary,
  TSurveySummaryDate,
  TSurveySummaryFileUpload,
  TSurveySummaryHiddenField,
  TSurveySummaryMultipleChoice,
  TSurveySummaryOpenText,
  TSurveySummaryPictureSelection,
  TSurveySummaryRating,
} from "@formbricks/types/responses";
import { TSurvey, TSurveyQuestionType } from "@formbricks/types/surveys";

import { sanitizeString } from "../strings";
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

const convertFloatTo2Decimal = (num: number) => {
  return Math.round(num * 100) / 100;
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
  const dropOffCount = responseCount - completedResponses;
  const dropOffPercentage = responseCount > 0 ? (dropOffCount / responseCount) * 100 : 0;
  const ttcAverage = ttcResponseCount > 0 ? ttcSum / ttcResponseCount : 0;

  return {
    displayCount: displayCount || 0,
    totalResponses: responseCount,
    startsPercentage: convertFloatTo2Decimal(startsPercentage),
    completedResponses,
    completedPercentage: convertFloatTo2Decimal(completedPercentage),
    dropOffCount,
    dropOffPercentage: convertFloatTo2Decimal(dropOffPercentage),
    ttcAverage: convertFloatTo2Decimal(ttcAverage),
  };
};

export const getSurveySummaryDropOff = (
  survey: TSurvey,
  responses: TResponse[],
  displayCount: number
): TSurveySummary["dropOff"] => {
  const initialTtc = survey.questions.reduce((acc: Record<string, number>, question) => {
    acc[question.id] = 0;
    return acc;
  }, {});

  let totalTtc = { ...initialTtc };
  let responseCounts = { ...initialTtc };

  let dropOffArr = new Array(survey.questions.length).fill(0) as number[];
  let viewsArr = new Array(survey.questions.length).fill(0) as number[];
  let dropOffPercentageArr = new Array(survey.questions.length).fill(0) as number[];

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
            dropOffArr[currQuesIdx]++;
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
        dropOffArr[currQuesIdx]++;
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
        dropOffArr[nextQuesIdx]++;
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
    dropOffArr[0] = displayCount - viewsArr[0];
    if (viewsArr[0] > displayCount) dropOffPercentageArr[0] = 0;

    dropOffPercentageArr[0] =
      viewsArr[0] - displayCount >= 0 ? 0 : ((displayCount - viewsArr[0]) / displayCount) * 100 || 0;

    viewsArr[0] = displayCount;
  } else {
    dropOffPercentageArr[0] = (dropOffArr[0] / viewsArr[0]) * 100;
  }

  for (let i = 1; i < survey.questions.length; i++) {
    if (viewsArr[i] !== 0) {
      dropOffPercentageArr[i] = (dropOffArr[i] / viewsArr[i]) * 100;
    }
  }

  const dropOff = survey.questions.map((question, index) => {
    return {
      questionId: question.id,
      headline: question.headline,
      ttc: convertFloatTo2Decimal(totalTtc[question.id]) || 0,
      views: viewsArr[index] || 0,
      dropOffCount: dropOffArr[index] || 0,
      dropOffPercentage: convertFloatTo2Decimal(dropOffPercentageArr[index]) || 0,
    };
  });

  return dropOff;
};

export const getQuestionWiseSummary = (
  survey: TSurvey,
  responses: TResponse[]
): TSurveySummary["summary"] => {
  const VALUES_LIMIT = 10;
  let summary: TSurveySummary["summary"] = [];

  survey.questions.forEach((question) => {
    switch (question.type) {
      case TSurveyQuestionType.OpenText: {
        let values: TSurveySummaryOpenText["samples"] = [];
        responses.forEach((response) => {
          const answer = response.data[question.id];
          if (answer && typeof answer === "string") {
            values.push({
              id: response.id,
              updatedAt: response.updatedAt,
              value: answer,
              person: response.person,
            });
          }
        });

        summary.push({
          type: question.type,
          question,
          responseCount: values.length,
          samples: values.slice(0, VALUES_LIMIT),
        });

        values = [];
        break;
      }
      case TSurveyQuestionType.MultipleChoiceSingle:
      case TSurveyQuestionType.MultipleChoiceMulti: {
        let values: TSurveySummaryMultipleChoice["choices"] = [];
        // check last choice is others or not
        const lastChoice = question.choices[question.choices.length - 1];
        const isOthersEnabled = lastChoice.id === "other";

        const questionChoices = question.choices.map((choice) => choice.label);
        if (isOthersEnabled) {
          questionChoices.pop();
        }

        let totalResponseCount = 0;
        const choiceCountMap = questionChoices.reduce((acc: Record<string, number>, choice) => {
          acc[choice] = 0;
          return acc;
        }, {});
        const otherValues: { value: string; person: TPerson | null }[] = [];

        responses.forEach((response) => {
          const answer = response.data[question.id];

          if (Array.isArray(answer)) {
            answer.forEach((value) => {
              totalResponseCount++;
              if (questionChoices.includes(value)) {
                choiceCountMap[value]++;
              } else {
                otherValues.push({
                  value,
                  person: response.person,
                });
              }
            });
          } else if (typeof answer === "string") {
            totalResponseCount++;
            if (questionChoices.includes(answer)) {
              choiceCountMap[answer]++;
            } else {
              otherValues.push({
                value: answer,
                person: response.person,
              });
            }
          }
        });

        Object.entries(choiceCountMap).map(([label, count]) => {
          values.push({
            value: label,
            count,
            percentage:
              totalResponseCount > 0 ? convertFloatTo2Decimal((count / totalResponseCount) * 100) : 0,
          });
        });

        if (isOthersEnabled) {
          values.push({
            value: lastChoice.label || "Other",
            count: otherValues.length,
            percentage: convertFloatTo2Decimal((otherValues.length / totalResponseCount) * 100),
            others: otherValues.slice(0, VALUES_LIMIT),
          });
        }

        summary.push({
          type: question.type,
          question,
          responseCount: totalResponseCount,
          choices: values,
        });

        values = [];
        break;
      }
      case TSurveyQuestionType.PictureSelection: {
        let values: TSurveySummaryPictureSelection["choices"] = [];
        const choiceCountMap: Record<string, number> = {};

        question.choices.forEach((choice) => {
          choiceCountMap[choice.id] = 0;
        });
        let totalResponseCount = 0;

        responses.forEach((response) => {
          const answer = response.data[question.id];
          if (Array.isArray(answer)) {
            answer.forEach((value) => {
              totalResponseCount++;
              choiceCountMap[value]++;
            });
          }
        });

        question.choices.forEach((choice) => {
          values.push({
            id: choice.id,
            imageUrl: choice.imageUrl,
            count: choiceCountMap[choice.id],
            percentage:
              totalResponseCount > 0
                ? convertFloatTo2Decimal((choiceCountMap[choice.id] / totalResponseCount) * 100)
                : 0,
          });
        });

        summary.push({
          type: question.type,
          question,
          responseCount: totalResponseCount,
          choices: values,
        });

        values = [];
        break;
      }
      case TSurveyQuestionType.Rating: {
        let values: TSurveySummaryRating["choices"] = [];
        const choiceCountMap: Record<number, number> = {};
        const range = question.range;

        for (let i = 1; i <= range; i++) {
          choiceCountMap[i] = 0;
        }

        let totalResponseCount = 0;
        let totalRating = 0;
        let dismissed = 0;

        responses.forEach((response) => {
          const answer = response.data[question.id];
          if (typeof answer === "number") {
            totalResponseCount++;
            choiceCountMap[answer]++;
            totalRating += answer;
          } else if (response.ttc && response.ttc[question.id] > 0) {
            totalResponseCount++;
            dismissed++;
          }
        });

        Object.entries(choiceCountMap).map(([label, count]) => {
          values.push({
            rating: parseInt(label),
            count,
            percentage:
              totalResponseCount > 0 ? convertFloatTo2Decimal((count / totalResponseCount) * 100) : 0,
          });
        });

        summary.push({
          type: question.type,
          question,
          average: convertFloatTo2Decimal(totalRating / (totalResponseCount - dismissed)) || 0,
          responseCount: totalResponseCount,
          choices: values,
          dismissed: {
            count: dismissed,
            percentage:
              totalResponseCount > 0 ? convertFloatTo2Decimal((dismissed / totalResponseCount) * 100) : 0,
          },
        });

        values = [];
        break;
      }
      case TSurveyQuestionType.NPS: {
        const data = {
          promoters: 0,
          passives: 0,
          detractors: 0,
          dismissed: 0,
          total: 0,
          score: 0,
        };

        responses.forEach((response) => {
          const value = response.data[question.id];
          if (typeof value === "number") {
            data.total++;
            if (value >= 9) {
              data.promoters++;
            } else if (value >= 7) {
              data.passives++;
            } else {
              data.detractors++;
            }
          } else if (response.ttc && response.ttc[question.id] > 0) {
            data.total++;
            data.dismissed++;
          }
        });

        data.score =
          data.total > 0
            ? convertFloatTo2Decimal(((data.promoters - data.detractors) / data.total) * 100)
            : 0;

        summary.push({
          type: question.type,
          question,
          responseCount: data.total,
          total: data.total,
          score: data.score,
          promoters: {
            count: data.promoters,
            percentage: data.total > 0 ? convertFloatTo2Decimal((data.promoters / data.total) * 100) : 0,
          },
          passives: {
            count: data.passives,
            percentage: data.total > 0 ? convertFloatTo2Decimal((data.passives / data.total) * 100) : 0,
          },
          detractors: {
            count: data.detractors,
            percentage: data.total > 0 ? convertFloatTo2Decimal((data.detractors / data.total) * 100) : 0,
          },
          dismissed: {
            count: data.dismissed,
            percentage: data.total > 0 ? convertFloatTo2Decimal((data.dismissed / data.total) * 100) : 0,
          },
        });
        break;
      }
      case TSurveyQuestionType.CTA: {
        const data = {
          clicked: 0,
          dismissed: 0,
        };

        responses.forEach((response) => {
          const value = response.data[question.id];
          if (value === "clicked") {
            data.clicked++;
          } else if (value === "dismissed") {
            data.dismissed++;
          }
        });

        const totalResponses = data.clicked + data.dismissed;

        summary.push({
          type: question.type,
          question,
          responseCount: totalResponses,
          ctr: {
            count: data.clicked,
            percentage:
              totalResponses > 0 ? convertFloatTo2Decimal((data.clicked / totalResponses) * 100) : 0,
          },
        });
        break;
      }
      case TSurveyQuestionType.Consent: {
        const data = {
          accepted: 0,
          dismissed: 0,
        };

        responses.forEach((response) => {
          const value = response.data[question.id];
          if (value === "accepted") {
            data.accepted++;
          } else if (response.ttc && response.ttc[question.id] > 0) {
            data.dismissed++;
          }
        });

        const totalResponses = data.accepted + data.dismissed;

        summary.push({
          type: question.type,
          question,
          responseCount: totalResponses,
          accepted: {
            count: data.accepted,
            percentage:
              totalResponses > 0 ? convertFloatTo2Decimal((data.accepted / totalResponses) * 100) : 0,
          },
          dismissed: {
            count: data.dismissed,
            percentage:
              totalResponses > 0 ? convertFloatTo2Decimal((data.dismissed / totalResponses) * 100) : 0,
          },
        });

        break;
      }
      case TSurveyQuestionType.Date: {
        let values: TSurveySummaryDate["samples"] = [];
        responses.forEach((response) => {
          const answer = response.data[question.id];
          if (answer && typeof answer === "string") {
            values.push({
              id: response.id,
              updatedAt: response.updatedAt,
              value: answer,
              person: response.person,
            });
          }
        });

        summary.push({
          type: question.type,
          question,
          responseCount: values.length,
          samples: values.slice(0, VALUES_LIMIT),
        });

        values = [];
        break;
      }
      case TSurveyQuestionType.FileUpload: {
        let values: TSurveySummaryFileUpload["files"] = [];
        responses.forEach((response) => {
          const answer = response.data[question.id];
          if (Array.isArray(answer)) {
            values.push({
              id: response.id,
              updatedAt: response.updatedAt,
              value: answer,
              person: response.person,
            });
          }
        });

        summary.push({
          type: question.type,
          question,
          responseCount: values.length,
          files: values.slice(0, VALUES_LIMIT),
        });

        values = [];
        break;
      }
      case TSurveyQuestionType.Cal: {
        const data = {
          booked: 0,
          skipped: 0,
        };

        responses.forEach((response) => {
          const value = response.data[question.id];
          if (value === "booked") {
            data.booked++;
          } else if (response.ttc && response.ttc[question.id] > 0) {
            data.skipped++;
          }
        });
        const totalResponses = data.booked + data.skipped;

        summary.push({
          type: question.type,
          question,
          responseCount: totalResponses,
          booked: {
            count: data.booked,
            percentage: totalResponses > 0 ? convertFloatTo2Decimal((data.booked / totalResponses) * 100) : 0,
          },
          skipped: {
            count: data.skipped,
            percentage:
              totalResponses > 0 ? convertFloatTo2Decimal((data.skipped / totalResponses) * 100) : 0,
          },
        });

        break;
      }
    }
  });

  survey.hiddenFields?.fieldIds?.forEach((question) => {
    let values: TSurveySummaryHiddenField["samples"] = [];
    responses.forEach((response) => {
      const answer = response.data[question];
      if (answer && typeof answer === "string") {
        values.push({
          updatedAt: response.updatedAt,
          value: answer,
          person: response.person,
        });
      }
    });

    summary.push({
      type: "hiddenField",
      question,
      responseCount: values.length,
      samples: values.slice(0, VALUES_LIMIT),
    });

    values = [];
  });

  return summary;
};
