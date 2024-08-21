import "server-only";
import { Prisma } from "@prisma/client";
import {
  TResponse,
  TResponseFilterCriteria,
  TResponseHiddenFieldsFilter,
  TResponseTtc,
  TSurveyMetaFieldFilter,
  TSurveyPersonAttributes,
} from "@formbricks/types/responses";
import {
  TSurvey,
  TSurveyLanguage,
  TSurveyMultipleChoiceQuestion,
  TSurveyQuestionSummaryAddress,
  TSurveyQuestionSummaryDate,
  TSurveyQuestionSummaryFileUpload,
  TSurveyQuestionSummaryHiddenFields,
  TSurveyQuestionSummaryMultipleChoice,
  TSurveyQuestionSummaryOpenText,
  TSurveyQuestionSummaryPictureSelection,
  TSurveyQuestionSummaryRating,
  TSurveyQuestionTypeEnum,
  TSurveySummary,
} from "@formbricks/types/surveys/types";
import { getLocalizedValue } from "../i18n/utils";
import { processResponseData } from "../responses";
import { getTodaysDateTimeFormatted } from "../time";
import { evaluateCondition } from "../utils/evaluateLogic";
import { sanitizeString } from "../utils/strings";

export const calculateTtcTotal = (ttc: TResponseTtc) => {
  const result = { ...ttc };
  result._total = Object.values(result).reduce((acc: number, val: number) => acc + val, 0);

  return result;
};

export const buildWhereClause = (filterCriteria?: TResponseFilterCriteria) => {
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
      switch (val.op) {
        case "submitted":
          data.push({
            data: {
              path: [key],
              not: Prisma.DbNull,
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
    return `${idx + 1}. ${headline}`;
  });
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
      "Formbricks ID (internal)": response.person?.id || "",
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
      jsonData[idx][question] = processResponseData(answer);
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
        jsonData[idx][field] = processResponseData(value);
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
  let impressionsArr = new Array(survey.questions.length).fill(0) as number[];
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
          impressionsArr[currQuesIdx]++;

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
        impressionsArr[currQuesIdx]++;
        break;
      }

      impressionsArr[currQuesIdx]++;

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
        impressionsArr[nextQuesIdx]++;
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
    dropOffArr[0] = displayCount - impressionsArr[0];
    if (impressionsArr[0] > displayCount) dropOffPercentageArr[0] = 0;

    dropOffPercentageArr[0] =
      impressionsArr[0] - displayCount >= 0
        ? 0
        : ((displayCount - impressionsArr[0]) / displayCount) * 100 || 0;

    impressionsArr[0] = displayCount;
  } else {
    dropOffPercentageArr[0] = (dropOffArr[0] / impressionsArr[0]) * 100;
  }

  for (let i = 1; i < survey.questions.length; i++) {
    if (impressionsArr[i] !== 0) {
      dropOffPercentageArr[i] = (dropOffArr[i] / impressionsArr[i]) * 100;
    }
  }

  const dropOff = survey.questions.map((question, index) => {
    return {
      questionId: question.id,
      headline: getLocalizedValue(question.headline, "default"),
      ttc: convertFloatTo2Decimal(totalTtc[question.id]) || 0,
      impressions: impressionsArr[index] || 0,
      dropOffCount: dropOffArr[index] || 0,
      dropOffPercentage: convertFloatTo2Decimal(dropOffPercentageArr[index]) || 0,
    };
  });

  return dropOff;
};

const getLanguageCode = (surveyLanguages: TSurveyLanguage[], languageCode: string | null) => {
  if (!surveyLanguages?.length || !languageCode) return "default";
  const language = surveyLanguages.find((surveyLanguage) => surveyLanguage.language.code === languageCode);
  return language?.default ? "default" : language?.language.code || "default";
};

const checkForI18n = (response: TResponse, id: string, survey: TSurvey, languageCode: string) => {
  const question = survey.questions.find((question) => question.id === id);

  if (question?.type === "multipleChoiceMulti") {
    // Initialize an array to hold the choice values
    let choiceValues = [] as string[];

    (typeof response.data[id] === "string"
      ? ([response.data[id]] as string[])
      : (response.data[id] as string[])
    )?.forEach((data) => {
      choiceValues.push(
        getLocalizedValue(
          question.choices.find((choice) => choice.label[languageCode] === data)?.label,
          "default"
        ) || data
      );
    });

    // Return the array of localized choice values of multiSelect multi questions
    return choiceValues;
  }

  // Return the localized value of the choice fo multiSelect single question
  const choice = (question as TSurveyMultipleChoiceQuestion)?.choices.find(
    (choice) => choice.label[languageCode] === response.data[id]
  );

  return getLocalizedValue(choice?.label, "default") || response.data[id];
};

export const getQuestionWiseSummary = (
  survey: TSurvey,
  responses: TResponse[],
  dropOff: TSurveySummary["dropOff"]
): TSurveySummary["summary"] => {
  const VALUES_LIMIT = 50;
  let summary: TSurveySummary["summary"] = [];

  survey.questions.forEach((question, idx) => {
    switch (question.type) {
      case TSurveyQuestionTypeEnum.OpenText: {
        let values: TSurveyQuestionSummaryOpenText["samples"] = [];
        responses.forEach((response) => {
          const answer = response.data[question.id];
          if (answer && typeof answer === "string") {
            values.push({
              id: response.id,
              updatedAt: response.updatedAt,
              value: answer,
              person: response.person,
              personAttributes: response.personAttributes,
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
      case TSurveyQuestionTypeEnum.MultipleChoiceSingle:
      case TSurveyQuestionTypeEnum.MultipleChoiceMulti: {
        let values: TSurveyQuestionSummaryMultipleChoice["choices"] = [];
        // check last choice is others or not
        const lastChoice = question.choices[question.choices.length - 1];
        const isOthersEnabled = lastChoice.id === "other";

        const questionChoices = question.choices.map((choice) => getLocalizedValue(choice.label, "default"));
        if (isOthersEnabled) {
          questionChoices.pop();
        }

        let totalResponseCount = 0;
        const choiceCountMap = questionChoices.reduce((acc: Record<string, number>, choice) => {
          acc[choice] = 0;
          return acc;
        }, {});

        const otherValues: TSurveyQuestionSummaryMultipleChoice["choices"][number]["others"] = [];
        responses.forEach((response) => {
          const responseLanguageCode = getLanguageCode(survey.languages, response.language);

          const answer =
            responseLanguageCode === "default"
              ? response.data[question.id]
              : checkForI18n(response, question.id, survey, responseLanguageCode);

          if (Array.isArray(answer)) {
            answer.forEach((value) => {
              totalResponseCount++;
              if (questionChoices.includes(value)) {
                choiceCountMap[value]++;
              } else {
                otherValues.push({
                  value,
                  person: response.person,
                  personAttributes: response.personAttributes,
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
                personAttributes: response.personAttributes,
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
            value: getLocalizedValue(lastChoice.label, "default") || "Other",
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
      case TSurveyQuestionTypeEnum.PictureSelection: {
        let values: TSurveyQuestionSummaryPictureSelection["choices"] = [];
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
      case TSurveyQuestionTypeEnum.Rating: {
        let values: TSurveyQuestionSummaryRating["choices"] = [];
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
          average: convertFloatTo2Decimal(totalRating / totalResponseCount) || 0,
          responseCount: totalResponseCount,
          choices: values,
          dismissed: {
            count: dismissed,
          },
        });

        values = [];
        break;
      }
      case TSurveyQuestionTypeEnum.NPS: {
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
      case TSurveyQuestionTypeEnum.CTA: {
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
        const impressions = dropOff[idx].impressions;

        summary.push({
          type: question.type,
          question,
          impressionCount: impressions,
          clickCount: data.clicked,
          skipCount: data.dismissed,
          responseCount: totalResponses,
          ctr: {
            count: data.clicked,
            percentage: impressions > 0 ? convertFloatTo2Decimal((data.clicked / impressions) * 100) : 0,
          },
        });
        break;
      }
      case TSurveyQuestionTypeEnum.Consent: {
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
      case TSurveyQuestionTypeEnum.Date: {
        let values: TSurveyQuestionSummaryDate["samples"] = [];
        responses.forEach((response) => {
          const answer = response.data[question.id];
          if (answer && typeof answer === "string") {
            values.push({
              id: response.id,
              updatedAt: response.updatedAt,
              value: answer,
              person: response.person,
              personAttributes: response.personAttributes,
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
      case TSurveyQuestionTypeEnum.FileUpload: {
        let values: TSurveyQuestionSummaryFileUpload["files"] = [];
        responses.forEach((response) => {
          const answer = response.data[question.id];
          if (Array.isArray(answer)) {
            values.push({
              id: response.id,
              updatedAt: response.updatedAt,
              value: answer,
              person: response.person,
              personAttributes: response.personAttributes,
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
      case TSurveyQuestionTypeEnum.Cal: {
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
      case TSurveyQuestionTypeEnum.Matrix: {
        const rows = question.rows.map((row) => getLocalizedValue(row, "default"));
        const columns = question.columns.map((column) => getLocalizedValue(column, "default"));
        let totalResponseCount = 0;

        // Initialize count object
        const countMap: Record<string, string> = rows.reduce((acc, row) => {
          acc[row] = columns.reduce((colAcc, col) => {
            colAcc[col] = 0;
            return colAcc;
          }, {});
          return acc;
        }, {});

        responses.forEach((response) => {
          const selectedResponses = response.data[question.id] as Record<string, string>;
          const responseLanguageCode = getLanguageCode(survey.languages, response.language);
          if (selectedResponses) {
            totalResponseCount++;
            question.rows.forEach((row) => {
              const localizedRow = getLocalizedValue(row, responseLanguageCode);
              const colValue = question.columns.find((column) => {
                return getLocalizedValue(column, responseLanguageCode) === selectedResponses[localizedRow];
              });
              const colValueInDefaultLanguage = getLocalizedValue(colValue, "default");
              if (colValueInDefaultLanguage && columns.includes(colValueInDefaultLanguage)) {
                countMap[getLocalizedValue(row, "default")][colValueInDefaultLanguage] += 1;
              }
            });
          }
        });

        const matrixSummary = rows.map((row) => {
          let totalResponsesForRow = 0;
          columns.forEach((col) => {
            totalResponsesForRow += countMap[row][col];
          });

          const columnPercentages = columns.reduce((acc, col) => {
            const count = countMap[row][col];
            const percentage =
              totalResponsesForRow > 0 ? ((count / totalResponsesForRow) * 100).toFixed(2) : "0.00";
            acc[col] = percentage;
            return acc;
          }, {});

          return { rowLabel: row, columnPercentages, totalResponsesForRow };
        });

        summary.push({
          type: question.type,
          question,
          responseCount: totalResponseCount,
          data: matrixSummary,
        });
        break;
      }
      case TSurveyQuestionTypeEnum.Address: {
        let values: TSurveyQuestionSummaryAddress["samples"] = [];
        responses.forEach((response) => {
          const answer = response.data[question.id];
          if (Array.isArray(answer) && answer.length > 0) {
            values.push({
              id: response.id,
              updatedAt: response.updatedAt,
              value: answer,
              person: response.person,
              personAttributes: response.personAttributes,
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
    }
  });

  survey.hiddenFields?.fieldIds?.forEach((hiddenFieldId) => {
    let values: TSurveyQuestionSummaryHiddenFields["samples"] = [];
    responses.forEach((response) => {
      const answer = response.data[hiddenFieldId];
      if (answer && typeof answer === "string") {
        values.push({
          updatedAt: response.updatedAt,
          value: answer,
          person: response.person,
          personAttributes: response.personAttributes,
        });
      }
    });

    summary.push({
      type: "hiddenField",
      id: hiddenFieldId,
      responseCount: values.length,
      samples: values.slice(0, VALUES_LIMIT),
    });

    values = [];
  });

  return summary;
};

export const getResponsePersonAttributes = (
  responses: Pick<TResponse, "personAttributes" | "data" | "meta">[]
): TSurveyPersonAttributes => {
  try {
    let attributes: TSurveyPersonAttributes = {};

    responses.forEach((response) => {
      Object.keys(response.personAttributes ?? {}).forEach((key) => {
        if (response.personAttributes && attributes[key]) {
          attributes[key].push(response.personAttributes[key].toString());
        } else if (response.personAttributes) {
          attributes[key] = [response.personAttributes[key].toString()];
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
  responses: Pick<TResponse, "personAttributes" | "data" | "meta">[]
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
  responses: Pick<TResponse, "personAttributes" | "data" | "meta">[]
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
