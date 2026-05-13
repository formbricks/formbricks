import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { ZId, ZOptionalNumber } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import {
  TResponseContact,
  TResponseContactAttributes,
  TResponseData,
  TResponseFilterCriteria,
  TResponseTtc,
  ZResponseFilterCriteria,
} from "@formbricks/types/responses";
import { TSurveyElement, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import {
  TSurvey,
  TSurveyElementSummaryAddress,
  TSurveyElementSummaryContactInfo,
  TSurveyElementSummaryDate,
  TSurveyElementSummaryFileUpload,
  TSurveyElementSummaryHiddenFields,
  TSurveyElementSummaryMultipleChoice,
  TSurveyElementSummaryOpenText,
  TSurveyElementSummaryPictureSelection,
  TSurveyElementSummaryRanking,
  TSurveyElementSummaryRating,
  TSurveyLanguage,
  TSurveySummary,
} from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { getQuotasSummary } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/lib/survey";
import { RESPONSES_PER_PAGE } from "@/lib/constants";
import { getDisplayCountBySurveyId } from "@/lib/display/service";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { buildWhereClause } from "@/lib/response/utils";
import { getSurvey } from "@/lib/survey/service";
import { getElementsFromBlocks } from "@/lib/survey/utils";
import { validateInputs } from "@/lib/utils/validate";
import { convertFloatTo2Decimal } from "./utils";

interface TSurveySummaryResponse {
  id: string;
  data: TResponseData;
  updatedAt: Date;
  contact: TResponseContact | null;
  contactAttributes: TResponseContactAttributes;
  language: string | null;
  ttc: TResponseTtc;
  finished: boolean;
}

const getElementIdToBlockIdMap = (survey: TSurvey): Record<string, string> => {
  return survey.blocks.reduce<Record<string, string>>((acc, block) => {
    block.elements.forEach((element) => {
      acc[element.id] = block.id;
    });
    return acc;
  }, {});
};

const getBlockTimesForResponse = (
  response: TSurveySummaryResponse,
  survey: TSurvey
): Record<string, number> => {
  return survey.blocks.reduce<Record<string, number>>((acc, block) => {
    const maxElementTtc = block.elements.reduce((maxTtc, element) => {
      const elementTtc = response.ttc?.[element.id] ?? 0;
      return Math.max(maxTtc, elementTtc);
    }, 0);

    acc[block.id] = maxElementTtc;
    return acc;
  }, {});
};

export const getSurveySummaryMeta = (
  survey: TSurvey,
  responses: TSurveySummaryResponse[],
  displayCount: number,
  quotas: TSurveySummary["quotas"]
): TSurveySummary["meta"] => {
  const completedResponses = responses.filter((response) => response.finished).length;

  let ttcResponseCount = 0;
  const ttcSum = responses.reduce((acc, response) => {
    const blockTimes = getBlockTimesForResponse(response, survey);
    const responseBlockTtcTotal = Object.values(blockTimes).reduce((sum, ttc) => sum + ttc, 0);

    // Fallback to _total for malformed surveys with no block mappings.
    const responseTtcTotal = responseBlockTtcTotal > 0 ? responseBlockTtcTotal : (response.ttc?._total ?? 0);

    if (responseTtcTotal > 0) {
      ttcResponseCount++;
      return acc + responseTtcTotal;
    }
    return acc;
  }, 0);
  const responseCount = responses.length;

  const startsPercentage = displayCount > 0 ? (responseCount / displayCount) * 100 : 0;
  const completedPercentage = displayCount > 0 ? (completedResponses / displayCount) * 100 : 0;
  const dropOffCount = responseCount - completedResponses;
  const dropOffPercentage = responseCount > 0 ? (dropOffCount / responseCount) * 100 : 0;
  const ttcAverage = ttcResponseCount > 0 ? ttcSum / ttcResponseCount : 0;

  const quotasCompleted = quotas.filter((quota) => quota.count >= quota.limit).length;
  const quotasCompletedPercentage = quotas.length > 0 ? (quotasCompleted / quotas.length) * 100 : 0;

  return {
    displayCount: displayCount || 0,
    totalResponses: responseCount,
    startsPercentage: convertFloatTo2Decimal(startsPercentage),
    completedResponses,
    completedPercentage: convertFloatTo2Decimal(completedPercentage),
    dropOffCount,
    dropOffPercentage: convertFloatTo2Decimal(dropOffPercentage),
    ttcAverage: convertFloatTo2Decimal(ttcAverage),
    quotasCompleted,
    quotasCompletedPercentage,
  };
};

// Determine whether a response interacted with a given element.
// An element was "seen" if the respondent has a ttc entry for it OR provided an answer.
// This is more reliable than replaying survey logic, which can misattribute impressions
// when branching logic skips elements or when partial response data is insufficient
// to evaluate conditions correctly.
const wasElementSeen = (response: TSurveySummaryResponse, elementId: string): boolean => {
  return (response.ttc != null && response.ttc[elementId] > 0) || response.data[elementId] !== undefined;
};

export const getSurveySummaryDropOff = (
  survey: TSurvey,
  elements: TSurveyElement[],
  responses: TSurveySummaryResponse[],
  displayCount: number
): TSurveySummary["dropOff"] => {
  const initialTtc = elements.reduce((acc: Record<string, number>, element) => {
    acc[element.id] = 0;
    return acc;
  }, {});

  let totalTtc = { ...initialTtc };
  let responseCounts = { ...initialTtc };

  let dropOffArr = new Array(elements.length).fill(0) as number[];
  let impressionsArr = new Array(elements.length).fill(0) as number[];
  let dropOffPercentageArr = new Array(elements.length).fill(0) as number[];
  const elementIdToBlockId = getElementIdToBlockIdMap(survey);

  responses.forEach((response) => {
    // Calculate total time-to-completion per element
    const blockTimes = getBlockTimesForResponse(response, survey);
    Object.keys(totalTtc).forEach((elementId) => {
      const blockId = elementIdToBlockId[elementId];
      const blockTtc = blockId ? (blockTimes[blockId] ?? 0) : 0;
      if (blockTtc > 0) {
        totalTtc[elementId] += blockTtc;
        responseCounts[elementId]++;
      }
    });

    // Count impressions based on actual interaction data (ttc + response data)
    // instead of replaying survey logic which is unreliable with branching
    let lastSeenIdx = -1;

    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      if (wasElementSeen(response, element.id)) {
        impressionsArr[i]++;
        lastSeenIdx = i;
      }
    }

    // Attribute drop-off to the last element the respondent interacted with
    if (!response.finished && lastSeenIdx >= 0) {
      dropOffArr[lastSeenIdx]++;
    }
  });

  // Calculate the average time for each element
  Object.keys(totalTtc).forEach((elementId) => {
    totalTtc[elementId] = responseCounts[elementId] > 0 ? totalTtc[elementId] / responseCounts[elementId] : 0;
  });

  // When the welcome card is disabled, the first element's impressions should equal displayCount
  // because every survey display is an impression of the first element
  if (!survey.welcomeCard.enabled) {
    dropOffArr[0] = displayCount - impressionsArr[0];
    if (impressionsArr[0] > displayCount) dropOffPercentageArr[0] = 0;

    dropOffPercentageArr[0] =
      impressionsArr[0] - displayCount >= 0
        ? 0
        : ((displayCount - impressionsArr[0]) / displayCount) * 100 || 0;

    impressionsArr[0] = displayCount;
  } else {
    dropOffPercentageArr[0] = impressionsArr[0] > 0 ? (dropOffArr[0] / impressionsArr[0]) * 100 : 0;
  }

  for (let i = 1; i < elements.length; i++) {
    if (impressionsArr[i] !== 0) {
      dropOffPercentageArr[i] = (dropOffArr[i] / impressionsArr[i]) * 100;
    }
  }

  const dropOff = elements.map((element, index) => {
    return {
      elementId: element.id,
      elementType: element.type,
      headline: getTextContent(getLocalizedValue(element.headline, "default")),
      ttc: convertFloatTo2Decimal(totalTtc[element.id]) || 0,
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

const checkForI18n = (
  responseData: TResponseData,
  id: string,
  elements: TSurveyElement[],
  languageCode: string
) => {
  const element = elements.find((element) => element.id === id);

  if (
    element?.type === TSurveyElementTypeEnum.MultipleChoiceMulti ||
    element?.type === TSurveyElementTypeEnum.Ranking
  ) {
    // Initialize an array to hold the choice values
    let choiceValues = [] as string[];

    // Type guard: both element types have choices property
    const hasChoices = "choices" in element;
    if (!hasChoices) return [];

    (typeof responseData[id] === "string"
      ? ([responseData[id]] as string[])
      : (responseData[id] as string[])
    )?.forEach((data) => {
      choiceValues.push(
        getLocalizedValue(
          element.choices.find((choice) => choice.label[languageCode] === data)?.label,
          "default"
        ) || data
      );
    });

    // Return the array of localized choice values of multiSelect multi elements
    return choiceValues;
  }

  // Return the localized value of the choice fo multiSelect single element
  if (element?.type === TSurveyElementTypeEnum.MultipleChoiceSingle) {
    const choice = element.choices?.find((choice) => choice.label[languageCode] === responseData[id]);
    return choice ? getLocalizedValue(choice.label, "default") || responseData[id] : responseData[id];
  }

  return responseData[id];
};

export const getElementSummary = async (
  survey: TSurvey,
  elements: TSurveyElement[],
  responses: TSurveySummaryResponse[],
  dropOff: TSurveySummary["dropOff"]
): Promise<TSurveySummary["summary"]> => {
  const VALUES_LIMIT = 50;
  let summary: TSurveySummary["summary"] = [];

  for (const element of elements) {
    switch (element.type) {
      case TSurveyElementTypeEnum.OpenText: {
        let values: TSurveyElementSummaryOpenText["samples"] = [];
        responses.forEach((response) => {
          const answer = response.data[element.id];
          if (answer && typeof answer === "string") {
            values.push({
              id: response.id,
              updatedAt: response.updatedAt,
              value: answer,
              contact: response.contact,
              contactAttributes: response.contactAttributes,
            });
          }
        });

        summary.push({
          type: element.type,
          element: element,
          responseCount: values.length,
          samples: values.slice(0, VALUES_LIMIT),
        });

        values = [];
        break;
      }
      case TSurveyElementTypeEnum.MultipleChoiceSingle:
      case TSurveyElementTypeEnum.MultipleChoiceMulti: {
        let values: TSurveyElementSummaryMultipleChoice["choices"] = [];

        const otherOption = element.choices.find((choice) => choice.id === "other");
        const noneOption = element.choices.find((choice) => choice.id === "none");

        const elementChoices = element.choices
          .filter((choice) => choice.id !== "other" && choice.id !== "none")
          .map((choice) => getLocalizedValue(choice.label, "default"));

        const choiceCountMap = elementChoices.reduce((acc: Record<string, number>, choice) => {
          acc[choice] = 0;
          return acc;
        }, {});

        // Track "none" count separately
        const noneLabel = noneOption ? getLocalizedValue(noneOption.label, "default") : null;
        let noneCount = 0;

        const otherValues: TSurveyElementSummaryMultipleChoice["choices"][number]["others"] = [];
        let totalSelectionCount = 0;
        let totalResponseCount = 0;
        responses.forEach((response) => {
          const responseLanguageCode = getLanguageCode(survey.languages, response.language);

          const answer =
            responseLanguageCode === "default"
              ? response.data[element.id]
              : checkForI18n(response.data, element.id, elements, responseLanguageCode);

          let hasValidAnswer = false;

          if (Array.isArray(answer) && element.type === TSurveyElementTypeEnum.MultipleChoiceMulti) {
            answer.forEach((value) => {
              if (value) {
                totalSelectionCount++;
                if (elementChoices.includes(value)) {
                  choiceCountMap[value]++;
                } else if (noneLabel && value === noneLabel) {
                  noneCount++;
                } else if (otherOption) {
                  otherValues.push({
                    value,
                    contact: response.contact,
                    contactAttributes: response.contactAttributes,
                  });
                }
                hasValidAnswer = true;
              }
            });
          } else if (
            typeof answer === "string" &&
            element.type === TSurveyElementTypeEnum.MultipleChoiceSingle
          ) {
            if (answer) {
              totalSelectionCount++;
              if (elementChoices.includes(answer)) {
                choiceCountMap[answer]++;
              } else if (noneLabel && answer === noneLabel) {
                noneCount++;
              } else if (otherOption) {
                otherValues.push({
                  value: answer,
                  contact: response.contact,
                  contactAttributes: response.contactAttributes,
                });
              }
              hasValidAnswer = true;
            }
          }

          if (hasValidAnswer) {
            totalResponseCount++;
          }
        });

        Object.entries(choiceCountMap).forEach(([label, count]) => {
          values.push({
            value: label,
            count,
            percentage:
              totalResponseCount > 0 ? convertFloatTo2Decimal((count / totalResponseCount) * 100) : 0,
          });
        });

        if (otherOption) {
          values.push({
            value: getLocalizedValue(otherOption.label, "default") || "Other",
            count: otherValues.length,
            percentage:
              totalResponseCount > 0
                ? convertFloatTo2Decimal((otherValues.length / totalResponseCount) * 100)
                : 0,
            others: otherValues.slice(0, VALUES_LIMIT),
          });
        }

        // Add "none" option at the end if it exists
        if (noneOption && noneLabel) {
          values.push({
            value: noneLabel,
            count: noneCount,
            percentage:
              totalResponseCount > 0 ? convertFloatTo2Decimal((noneCount / totalResponseCount) * 100) : 0,
          });
        }

        summary.push({
          type: element.type,
          element,
          responseCount: totalResponseCount,
          selectionCount: totalSelectionCount,
          choices: values,
        });

        values = [];
        break;
      }
      case TSurveyElementTypeEnum.PictureSelection: {
        let values: TSurveyElementSummaryPictureSelection["choices"] = [];
        const choiceCountMap: Record<string, number> = {};

        element.choices.forEach((choice) => {
          choiceCountMap[choice.id] = 0;
        });
        let totalResponseCount = 0;
        let totalSelectionCount = 0;

        responses.forEach((response) => {
          const answer = response.data[element.id];
          if (Array.isArray(answer)) {
            totalResponseCount++;
            answer.forEach((value) => {
              totalSelectionCount++;
              choiceCountMap[value]++;
            });
          }
        });

        element.choices.forEach((choice) => {
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
          type: element.type,
          element,
          responseCount: totalResponseCount,
          selectionCount: totalSelectionCount,
          choices: values,
        });

        values = [];
        break;
      }
      case TSurveyElementTypeEnum.Rating: {
        let values: TSurveyElementSummaryRating["choices"] = [];
        const choiceCountMap: Record<number, number> = {};
        const range = element.range;

        for (let i = 1; i <= range; i++) {
          choiceCountMap[i] = 0;
        }

        let totalResponseCount = 0;
        let totalRating = 0;
        let dismissed = 0;

        responses.forEach((response) => {
          const answer = response.data[element.id];
          if (typeof answer === "number") {
            totalResponseCount++;
            choiceCountMap[answer]++;
            totalRating += answer;
          } else if (response.ttc && response.ttc[element.id] > 0) {
            dismissed++;
          }
        });

        Object.entries(choiceCountMap).forEach(([label, count]) => {
          values.push({
            rating: Number.parseInt(label),
            count,
            percentage:
              totalResponseCount > 0 ? convertFloatTo2Decimal((count / totalResponseCount) * 100) : 0,
          });
        });

        // Calculate CSAT based on range
        let satisfiedCount = 0;
        if (range === 3) {
          satisfiedCount = choiceCountMap[3] || 0;
        } else if (range === 4) {
          satisfiedCount = (choiceCountMap[3] || 0) + (choiceCountMap[4] || 0);
        } else if (range === 5) {
          satisfiedCount = (choiceCountMap[4] || 0) + (choiceCountMap[5] || 0);
        } else if (range === 6) {
          satisfiedCount = (choiceCountMap[5] || 0) + (choiceCountMap[6] || 0);
        } else if (range === 7) {
          satisfiedCount = (choiceCountMap[6] || 0) + (choiceCountMap[7] || 0);
        } else if (range === 10) {
          satisfiedCount = (choiceCountMap[8] || 0) + (choiceCountMap[9] || 0) + (choiceCountMap[10] || 0);
        }
        const satisfiedPercentage =
          totalResponseCount > 0 ? Math.round((satisfiedCount / totalResponseCount) * 100) : 0;

        summary.push({
          type: element.type,
          element,
          average: convertFloatTo2Decimal(totalRating / totalResponseCount) || 0,
          responseCount: totalResponseCount,
          choices: values,
          dismissed: {
            count: dismissed,
          },
          csat: {
            satisfiedCount,
            satisfiedPercentage,
          },
        });

        values = [];
        break;
      }
      case TSurveyElementTypeEnum.NPS: {
        const data = {
          promoters: 0,
          passives: 0,
          detractors: 0,
          dismissed: 0,
          total: 0,
          score: 0,
        };

        // Track individual score counts (0-10)
        const scoreCountMap: Record<number, number> = {};
        for (let i = 0; i <= 10; i++) {
          scoreCountMap[i] = 0;
        }

        responses.forEach((response) => {
          const value = response.data[element.id];
          if (typeof value === "number") {
            data.total++;
            scoreCountMap[value]++;
            if (value >= 9) {
              data.promoters++;
            } else if (value >= 7) {
              data.passives++;
            } else {
              data.detractors++;
            }
          } else if (response.ttc && response.ttc[element.id] > 0) {
            data.total++;
            data.dismissed++;
          }
        });

        data.score =
          data.total > 0
            ? convertFloatTo2Decimal(((data.promoters - data.detractors) / data.total) * 100)
            : 0;

        // Build choices array with individual score breakdown
        const choices = Object.entries(scoreCountMap).map(([rating, count]) => ({
          rating: Number.parseInt(rating),
          count,
          percentage: data.total > 0 ? convertFloatTo2Decimal((count / data.total) * 100) : 0,
        }));

        summary.push({
          type: element.type,
          element,
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
          choices,
        });
        break;
      }
      case TSurveyElementTypeEnum.CTA: {
        // Only calculate summary for CTA elements with external buttons (CTR tracking is only meaningful for external links)
        if (!element.buttonExternal) {
          break;
        }

        const data = {
          clicked: 0,
          dismissed: 0,
        };

        responses.forEach((response) => {
          const value = response.data[element.id];
          if (value === "clicked") {
            data.clicked++;
          } else if (value === "dismissed") {
            data.dismissed++;
          }
        });

        const totalResponses = data.clicked + data.dismissed;
        const idx = elements.findIndex((q) => q.id === element.id);
        const impressions = dropOff[idx].impressions;

        summary.push({
          type: element.type,
          element,
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
      case TSurveyElementTypeEnum.Consent: {
        const data = {
          accepted: 0,
          dismissed: 0,
        };

        responses.forEach((response) => {
          const value = response.data[element.id];
          if (value === "accepted") {
            data.accepted++;
          } else if (response.ttc && response.ttc[element.id] > 0) {
            data.dismissed++;
          }
        });

        const totalResponses = data.accepted + data.dismissed;

        summary.push({
          type: element.type,
          element,
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
      case TSurveyElementTypeEnum.Date: {
        let values: TSurveyElementSummaryDate["samples"] = [];
        responses.forEach((response) => {
          const answer = response.data[element.id];
          if (answer && typeof answer === "string") {
            values.push({
              id: response.id,
              updatedAt: response.updatedAt,
              value: answer,
              contact: response.contact,
              contactAttributes: response.contactAttributes,
            });
          }
        });

        summary.push({
          type: element.type,
          element,
          responseCount: values.length,
          samples: values.slice(0, VALUES_LIMIT),
        });

        values = [];
        break;
      }
      case TSurveyElementTypeEnum.FileUpload: {
        let values: TSurveyElementSummaryFileUpload["files"] = [];
        responses.forEach((response) => {
          const answer = response.data[element.id];
          if (Array.isArray(answer)) {
            values.push({
              id: response.id,
              updatedAt: response.updatedAt,
              value: answer,
              contact: response.contact,
              contactAttributes: response.contactAttributes,
            });
          }
        });

        summary.push({
          type: element.type,
          element,
          responseCount: values.length,
          files: values.slice(0, VALUES_LIMIT),
        });

        values = [];
        break;
      }
      case TSurveyElementTypeEnum.Cal: {
        const data = {
          booked: 0,
          skipped: 0,
        };

        responses.forEach((response) => {
          const value = response.data[element.id];
          if (value === "booked") {
            data.booked++;
          } else if (response.ttc && response.ttc[element.id] > 0) {
            data.skipped++;
          }
        });
        const totalResponses = data.booked + data.skipped;

        summary.push({
          type: element.type,
          element,
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
      case TSurveyElementTypeEnum.Matrix: {
        const rows = element.rows.map((row) => getLocalizedValue(row.label, "default"));
        const columns = element.columns.map((column) => getLocalizedValue(column.label, "default"));
        let totalResponseCount = 0;

        // Initialize count object
        const countMap: Record<string, Record<string, number>> = rows.reduce(
          (acc: Record<string, Record<string, number>>, row) => {
            acc[row] = columns.reduce(
              (colAcc: Record<string, number>, col) => {
                colAcc[col] = 0;
                return colAcc;
              },
              {} as Record<string, number>
            );
            return acc;
          },
          {} as Record<string, Record<string, number>>
        );

        responses.forEach((response) => {
          const selectedResponses = response.data[element.id] as Record<string, string>;
          const responseLanguageCode = getLanguageCode(survey.languages, response.language);
          if (selectedResponses) {
            totalResponseCount++;
            element.rows.forEach((row) => {
              const localizedRow = getLocalizedValue(row.label, responseLanguageCode);
              const colValue = element.columns.find((column) => {
                return (
                  getLocalizedValue(column.label, responseLanguageCode) === selectedResponses[localizedRow]
                );
              });
              const colValueInDefaultLanguage = getLocalizedValue(colValue?.label, "default");
              if (colValueInDefaultLanguage && columns.includes(colValueInDefaultLanguage)) {
                countMap[getLocalizedValue(row.label, "default")][colValueInDefaultLanguage] += 1;
              }
            });
          }
        });

        const matrixSummary = rows.map((row) => {
          let totalResponsesForRow = 0;
          columns.forEach((col) => {
            totalResponsesForRow += countMap[row][col];
          });

          const columnPercentages = columns.map((col) => {
            const count = countMap[row][col];
            const percentage =
              totalResponsesForRow > 0 ? ((count / totalResponsesForRow) * 100).toFixed(2) : "0.00";
            return {
              column: col,
              percentage: Number(percentage),
            };
          });

          return { rowLabel: row, columnPercentages, totalResponsesForRow };
        });

        summary.push({
          type: element.type,
          element,
          responseCount: totalResponseCount,
          data: matrixSummary,
        });
        break;
      }
      case TSurveyElementTypeEnum.Address: {
        let values: TSurveyElementSummaryAddress["samples"] = [];
        responses.forEach((response) => {
          const answer = response.data[element.id];
          if (Array.isArray(answer) && answer.length > 0) {
            values.push({
              id: response.id,
              updatedAt: response.updatedAt,
              value: answer,
              contact: response.contact,
              contactAttributes: response.contactAttributes,
            });
          }
        });

        summary.push({
          type: TSurveyElementTypeEnum.Address,
          element,
          responseCount: values.length,
          samples: values.slice(0, VALUES_LIMIT),
        });

        values = [];
        break;
      }
      case TSurveyElementTypeEnum.ContactInfo: {
        let values: TSurveyElementSummaryContactInfo["samples"] = [];
        responses.forEach((response) => {
          const answer = response.data[element.id];
          if (Array.isArray(answer) && answer.length > 0) {
            values.push({
              id: response.id,
              updatedAt: response.updatedAt,
              value: answer,
              contact: response.contact,
              contactAttributes: response.contactAttributes,
            });
          }
        });

        summary.push({
          type: TSurveyElementTypeEnum.ContactInfo,
          element,
          responseCount: values.length,
          samples: values.slice(0, VALUES_LIMIT),
        });

        values = [];
        break;
      }
      case TSurveyElementTypeEnum.Ranking: {
        let values: TSurveyElementSummaryRanking["choices"] = [];
        const elementChoices = element.choices.map((choice) => getLocalizedValue(choice.label, "default"));
        let totalResponseCount = 0;
        const choiceRankSums: Record<string, number> = {};
        const choiceCountMap: Record<string, number> = {};

        elementChoices.forEach((choice: string) => {
          choiceRankSums[choice] = 0;
          choiceCountMap[choice] = 0;
        });

        responses.forEach((response) => {
          const responseLanguageCode = getLanguageCode(survey.languages, response.language);

          const answer =
            responseLanguageCode === "default"
              ? response.data[element.id]
              : checkForI18n(response.data, element.id, elements, responseLanguageCode);

          if (Array.isArray(answer)) {
            totalResponseCount++;
            answer.forEach((value, index) => {
              const ranking = index + 1; // Calculate ranking based on index
              if (elementChoices.includes(value)) {
                choiceRankSums[value] += ranking;
                choiceCountMap[value]++;
              }
            });
          }
        });

        elementChoices.forEach((choice: string) => {
          const count = choiceCountMap[choice];
          const avgRanking = count > 0 ? choiceRankSums[choice] / count : 0;
          values.push({
            value: choice,
            count,
            avgRanking: convertFloatTo2Decimal(avgRanking),
          });
        });

        summary.push({
          type: element.type,
          element,
          responseCount: totalResponseCount,
          choices: values,
        });

        break;
      }
    }
  }

  survey.hiddenFields?.fieldIds?.forEach((hiddenFieldId) => {
    let values: TSurveyElementSummaryHiddenFields["samples"] = [];
    responses.forEach((response) => {
      const answer = response.data[hiddenFieldId];
      if (answer && typeof answer === "string") {
        values.push({
          updatedAt: response.updatedAt,
          value: answer,
          contact: response.contact,
          contactAttributes: response.contactAttributes,
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
  async (surveyId: string, filterCriteria?: TResponseFilterCriteria): Promise<TSurveySummary> => {
    validateInputs([surveyId, ZId], [filterCriteria, ZResponseFilterCriteria.optional()]);

    try {
      const survey = await getSurvey(surveyId);
      if (!survey) {
        throw new ResourceNotFoundError("Survey", surveyId);
      }

      const elements = getElementsFromBlocks(survey.blocks);

      const batchSize = 5000;
      const hasFilter = Object.keys(filterCriteria ?? {}).some((filterKey) => filterKey !== "createdAt");

      // Use cursor-based pagination instead of count + offset to avoid expensive queries
      const responses: TSurveySummaryResponse[] = [];
      let cursor: string | undefined = undefined;
      let hasMore = true;

      while (hasMore) {
        const batch = await getResponsesForSummary(surveyId, batchSize, 0, filterCriteria, cursor);
        responses.push(...batch);

        if (batch.length < batchSize) {
          hasMore = false;
        } else {
          // Use the last response's ID as cursor for next batch
          cursor = batch[batch.length - 1].id;
        }
      }

      const responseIds = hasFilter ? responses.map((response) => response.id) : [];

      const [displayCount, quotas] = await Promise.all([
        getDisplayCountBySurveyId(surveyId, {
          createdAt: filterCriteria?.createdAt,
          ...(hasFilter && { responseIds }),
        }),
        getQuotasSummary(surveyId),
      ]);

      const dropOff = getSurveySummaryDropOff(survey, elements, responses, displayCount);
      const meta = getSurveySummaryMeta(survey, responses, displayCount, quotas);
      const elementSummary = await getElementSummary(survey, elements, responses, dropOff);

      return {
        meta,
        dropOff,
        summary: elementSummary,
        quotas,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }

      throw error;
    }
  }
);

export const getResponsesForSummary = reactCache(
  async (
    surveyId: string,
    limit: number,
    offset: number,
    filterCriteria?: TResponseFilterCriteria,
    cursor?: string
  ): Promise<TSurveySummaryResponse[]> => {
    validateInputs(
      [surveyId, ZId],
      [limit, ZOptionalNumber],
      [offset, ZOptionalNumber],
      [filterCriteria, ZResponseFilterCriteria.optional()],
      [cursor, z.cuid2().optional()]
    );

    const queryLimit = limit ?? RESPONSES_PER_PAGE;
    const survey = await getSurvey(surveyId);
    if (!survey) return [];
    try {
      const whereClause: Prisma.ResponseWhereInput = {
        surveyId,
        ...buildWhereClause(survey, filterCriteria),
      };

      // Add cursor condition for cursor-based pagination
      if (cursor) {
        whereClause.id = {
          lt: cursor, // Get responses with ID less than cursor (for desc order)
        };
      }

      const responses = await prisma.response.findMany({
        where: whereClause,
        select: {
          id: true,
          data: true,
          updatedAt: true,
          contact: {
            select: {
              id: true,
              attributes: {
                select: { attributeKey: true, value: true },
              },
            },
          },
          contactAttributes: true,
          language: true,
          ttc: true,
          finished: true,
        },
        orderBy: [
          {
            createdAt: "desc",
          },
          {
            id: "desc", // Secondary sort by ID for consistent pagination
          },
        ],
        take: queryLimit,
        skip: offset,
      });

      const transformedResponses: TSurveySummaryResponse[] = await Promise.all(
        responses.map((responsePrisma) => {
          return {
            id: responsePrisma.id,
            data: (responsePrisma.data ?? {}) as TResponseData,
            updatedAt: responsePrisma.updatedAt,
            contact: responsePrisma.contact
              ? {
                  id: responsePrisma.contact.id as string,
                  userId: responsePrisma.contact.attributes.find(
                    (attribute) => attribute.attributeKey.key === "userId"
                  )?.value as string,
                }
              : null,
            contactAttributes: (responsePrisma.contactAttributes ?? {}) as TResponseContactAttributes,
            language: responsePrisma.language,
            ttc: (responsePrisma.ttc ?? {}) as TResponseTtc,
            finished: responsePrisma.finished,
          };
        })
      );

      return transformedResponses;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }

      throw error;
    }
  }
);
