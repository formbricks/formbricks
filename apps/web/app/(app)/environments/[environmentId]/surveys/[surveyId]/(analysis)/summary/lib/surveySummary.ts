import "server-only";
import { getInsightsBySurveyIdQuestionId } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/lib/insights";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { cache } from "@formbricks/lib/cache";
import { displayCache } from "@formbricks/lib/display/cache";
import { getDisplayCountBySurveyId } from "@formbricks/lib/display/service";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { responseCache } from "@formbricks/lib/response/cache";
import { getResponseCountBySurveyId, getResponses } from "@formbricks/lib/response/service";
import { surveyCache } from "@formbricks/lib/survey/cache";
import { getSurvey } from "@formbricks/lib/survey/service";
import { evaluateLogic, performActions } from "@formbricks/lib/surveyLogic/utils";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import {
  TResponse,
  TResponseData,
  TResponseFilterCriteria,
  TResponseVariables,
  ZResponseFilterCriteria,
} from "@formbricks/types/responses";
import {
  TSurvey,
  TSurveyContactInfoQuestion,
  TSurveyLanguage,
  TSurveyMultipleChoiceQuestion,
  TSurveyQuestion,
  TSurveyQuestionId,
  TSurveyQuestionSummaryAddress,
  TSurveyQuestionSummaryDate,
  TSurveyQuestionSummaryFileUpload,
  TSurveyQuestionSummaryHiddenFields,
  TSurveyQuestionSummaryMultipleChoice,
  TSurveyQuestionSummaryOpenText,
  TSurveyQuestionSummaryPictureSelection,
  TSurveyQuestionSummaryRanking,
  TSurveyQuestionSummaryRating,
  TSurveyQuestionTypeEnum,
  TSurveySummary,
} from "@formbricks/types/surveys/types";
import { convertFloatTo2Decimal } from "./utils";

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

const evaluateLogicAndGetNextQuestionId = (
  localSurvey: TSurvey,
  data: TResponseData,
  localVariables: TResponseVariables,
  currentQuestionIndex: number,
  currQuesTemp: TSurveyQuestion,
  selectedLanguage: string | null
): {
  nextQuestionId: TSurveyQuestionId | undefined;
  updatedSurvey: TSurvey;
  updatedVariables: TResponseVariables;
} => {
  const questions = localSurvey.questions;

  let updatedSurvey = { ...localSurvey };
  let updatedVariables = { ...localVariables };

  let firstJumpTarget: string | undefined;

  if (currQuesTemp.logic && currQuesTemp.logic.length > 0) {
    for (const logic of currQuesTemp.logic) {
      if (evaluateLogic(localSurvey, data, localVariables, logic.conditions, selectedLanguage ?? "default")) {
        const { jumpTarget, requiredQuestionIds, calculations } = performActions(
          updatedSurvey,
          logic.actions,
          data,
          updatedVariables
        );

        if (requiredQuestionIds.length > 0) {
          updatedSurvey.questions = updatedSurvey.questions.map((q) =>
            requiredQuestionIds.includes(q.id) ? { ...q, required: true } : q
          );
        }
        updatedVariables = { ...updatedVariables, ...calculations };

        if (jumpTarget && !firstJumpTarget) {
          firstJumpTarget = jumpTarget;
        }
      }
    }
  }

  // Return the first jump target if found, otherwise go to the next question
  const nextQuestionId = firstJumpTarget || questions[currentQuestionIndex + 1]?.id || undefined;

  return { nextQuestionId, updatedSurvey, updatedVariables };
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

  const surveyVariablesData = survey.variables?.reduce(
    (acc, variable) => {
      acc[variable.id] = variable.value;
      return acc;
    },
    {} as Record<string, string | number>
  );

  responses.forEach((response) => {
    // Calculate total time-to-completion
    Object.keys(totalTtc).forEach((questionId) => {
      if (response.ttc && response.ttc[questionId]) {
        totalTtc[questionId] += response.ttc[questionId];
        responseCounts[questionId]++;
      }
    });

    let localSurvey = structuredClone(survey);
    let localResponseData: TResponseData = { ...response.data };
    let localVariables: TResponseVariables = {
      ...surveyVariablesData,
    };

    let currQuesIdx = 0;

    while (currQuesIdx < localSurvey.questions.length) {
      const currQues = localSurvey.questions[currQuesIdx];
      if (!currQues) break;

      // question is not answered and required
      if (response.data[currQues.id] === undefined && currQues.required) {
        dropOffArr[currQuesIdx]++;
        impressionsArr[currQuesIdx]++;
        break;
      }

      impressionsArr[currQuesIdx]++;

      const { nextQuestionId, updatedSurvey, updatedVariables } = evaluateLogicAndGetNextQuestionId(
        localSurvey,
        localResponseData,
        localVariables,
        currQuesIdx,
        currQues,
        response.language
      );

      localSurvey = updatedSurvey;
      localVariables = updatedVariables;

      if (nextQuestionId) {
        const nextQuesIdx = survey.questions.findIndex((q) => q.id === nextQuestionId);
        if (!response.data[nextQuestionId] && !response.finished) {
          dropOffArr[nextQuesIdx]++;
          impressionsArr[nextQuesIdx]++;
          break;
        }
        currQuesIdx = nextQuesIdx;
      } else {
        currQuesIdx++;
      }
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
      questionType: question.type,
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

  if (question?.type === "multipleChoiceMulti" || question?.type === "ranking") {
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

export const getQuestionSummary = async (
  survey: TSurvey,
  responses: TResponse[],
  dropOff: TSurveySummary["dropOff"]
): Promise<TSurveySummary["summary"]> => {
  const VALUES_LIMIT = 50;
  let summary: TSurveySummary["summary"] = [];

  for (const question of survey.questions) {
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
        const insights = await getInsightsBySurveyIdQuestionId(survey.id, question.id, 50);

        summary.push({
          type: question.type,
          question,
          responseCount: values.length,
          samples: values.slice(0, VALUES_LIMIT),
          insights,
          insightsEnabled: question.insightsEnabled,
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

        const choiceCountMap = questionChoices.reduce((acc: Record<string, number>, choice) => {
          acc[choice] = 0;
          return acc;
        }, {});

        const otherValues: TSurveyQuestionSummaryMultipleChoice["choices"][number]["others"] = [];
        let totalSelectionCount = 0;
        let totalResponseCount = 0;
        responses.forEach((response) => {
          const responseLanguageCode = getLanguageCode(survey.languages, response.language);

          const answer =
            responseLanguageCode === "default"
              ? response.data[question.id]
              : checkForI18n(response, question.id, survey, responseLanguageCode);

          let hasValidAnswer = false;

          if (Array.isArray(answer)) {
            answer.forEach((value) => {
              if (value) {
                totalSelectionCount++;
                if (questionChoices.includes(value)) {
                  choiceCountMap[value]++;
                } else if (isOthersEnabled) {
                  otherValues.push({
                    value,
                    person: response.person,
                    personAttributes: response.personAttributes,
                  });
                }
                hasValidAnswer = true;
              }
            });
          } else if (typeof answer === "string") {
            if (answer) {
              totalSelectionCount++;
              if (questionChoices.includes(answer)) {
                choiceCountMap[answer]++;
              } else if (isOthersEnabled) {
                otherValues.push({
                  value: answer,
                  person: response.person,
                  personAttributes: response.personAttributes,
                });
              }
              hasValidAnswer = true;
            }
          }

          if (hasValidAnswer) {
            totalResponseCount++;
          }
        });

        Object.entries(choiceCountMap).map(([label, count]) => {
          values.push({
            value: label,
            count,
            percentage:
              totalSelectionCount > 0 ? convertFloatTo2Decimal((count / totalSelectionCount) * 100) : 0,
          });
        });

        if (isOthersEnabled) {
          values.push({
            value: getLocalizedValue(lastChoice.label, "default") || "Other",
            count: otherValues.length,
            percentage:
              totalSelectionCount > 0
                ? convertFloatTo2Decimal((otherValues.length / totalSelectionCount) * 100)
                : 0,
            others: otherValues.slice(0, VALUES_LIMIT),
          });
        }
        summary.push({
          type: question.type,
          question,
          responseCount: totalResponseCount,
          selectionCount: totalSelectionCount,
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
        let totalSelectionCount = 0;

        responses.forEach((response) => {
          const answer = response.data[question.id];
          if (Array.isArray(answer)) {
            totalResponseCount++;
            answer.forEach((value) => {
              totalSelectionCount++;
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
              totalSelectionCount > 0
                ? convertFloatTo2Decimal((choiceCountMap[choice.id] / totalSelectionCount) * 100)
                : 0,
          });
        });

        summary.push({
          type: question.type,
          question,
          responseCount: totalResponseCount,
          selectionCount: totalSelectionCount,
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
        const idx = survey.questions.findIndex((q) => q.id === question.id);
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
      case TSurveyQuestionTypeEnum.Address:
      case TSurveyQuestionTypeEnum.ContactInfo: {
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
          type: question.type as TSurveyQuestionTypeEnum.ContactInfo,
          question: question as TSurveyContactInfoQuestion,
          responseCount: values.length,
          samples: values.slice(0, VALUES_LIMIT),
        });

        values = [];
        break;
      }
      case TSurveyQuestionTypeEnum.Ranking: {
        let values: TSurveyQuestionSummaryRanking["choices"] = [];
        const questionChoices = question.choices.map((choice) => getLocalizedValue(choice.label, "default"));
        let totalResponseCount = 0;
        const choiceRankSums: Record<string, number> = {};
        const choiceCountMap: Record<string, number> = {};
        questionChoices.forEach((choice) => {
          choiceRankSums[choice] = 0;
          choiceCountMap[choice] = 0;
        });

        responses.forEach((response) => {
          const responseLanguageCode = getLanguageCode(survey.languages, response.language);

          const answer =
            responseLanguageCode === "default"
              ? response.data[question.id]
              : checkForI18n(response, question.id, survey, responseLanguageCode);

          if (Array.isArray(answer)) {
            totalResponseCount++;
            answer.forEach((value, index) => {
              const ranking = index + 1; // Calculate ranking based on index
              if (questionChoices.includes(value)) {
                choiceRankSums[value] += ranking;
                choiceCountMap[value]++;
              }
            });
          }
        });

        questionChoices.forEach((choice) => {
          const count = choiceCountMap[choice];
          const avgRanking = count > 0 ? choiceRankSums[choice] / count : 0;
          values.push({
            value: choice,
            count,
            avgRanking: convertFloatTo2Decimal(avgRanking),
          });
        });

        summary.push({
          type: question.type,
          question,
          responseCount: totalResponseCount,
          choices: values,
        });

        break;
      }
    }
  }

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

export const getSurveySummary = reactCache(
  (surveyId: string, filterCriteria?: TResponseFilterCriteria): Promise<TSurveySummary> =>
    cache(
      async () => {
        validateInputs([surveyId, ZId], [filterCriteria, ZResponseFilterCriteria.optional()]);

        try {
          const survey = await getSurvey(surveyId);
          if (!survey) {
            throw new ResourceNotFoundError("Survey", surveyId);
          }

          const batchSize = 3000;
          const totalResponseCount = await getResponseCountBySurveyId(surveyId);
          const filteredResponseCount = await getResponseCountBySurveyId(surveyId, filterCriteria);

          const hasFilter = totalResponseCount !== filteredResponseCount;

          const pages = Math.ceil(filteredResponseCount / batchSize);

          const responsesArray = await Promise.all(
            Array.from({ length: pages }, (_, i) => {
              return getResponses(surveyId, batchSize, i * batchSize, filterCriteria);
            })
          );
          const responses = responsesArray.flat();

          const responseIds = hasFilter ? responses.map((response) => response.id) : [];

          const displayCount = await getDisplayCountBySurveyId(surveyId, {
            createdAt: filterCriteria?.createdAt,
            ...(hasFilter && { responseIds }),
          });

          const dropOff = getSurveySummaryDropOff(survey, responses, displayCount);
          const meta = getSurveySummaryMeta(responses, displayCount);
          const questionWiseSummary = await getQuestionSummary(survey, responses, dropOff);

          return { meta, dropOff, summary: questionWiseSummary };
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getSurveySummary-${surveyId}-${JSON.stringify(filterCriteria)}`],
      {
        tags: [
          surveyCache.tag.byId(surveyId),
          responseCache.tag.bySurveyId(surveyId),
          displayCache.tag.bySurveyId(surveyId),
        ],
      }
    )()
);
