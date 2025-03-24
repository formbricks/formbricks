import { TPipelineInput } from "@/app/api/(internal)/pipeline/types/pipelines";
import { writeData as airtableWriteData } from "@formbricks/lib/airtable/service";
import { NOTION_RICH_TEXT_LIMIT } from "@formbricks/lib/constants";
import { writeData } from "@formbricks/lib/googleSheet/service";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { writeData as writeNotionData } from "@formbricks/lib/notion/service";
import { processResponseData } from "@formbricks/lib/responses";
import { writeDataToSlack } from "@formbricks/lib/slack/service";
import { getFormattedDateTimeString } from "@formbricks/lib/utils/datetime";
import { parseRecallInfo } from "@formbricks/lib/utils/recall";
import { truncateText } from "@formbricks/lib/utils/strings";
import { logger } from "@formbricks/logger";
import { Result } from "@formbricks/types/error-handlers";
import { TIntegration, TIntegrationType } from "@formbricks/types/integration";
import { TIntegrationAirtable } from "@formbricks/types/integration/airtable";
import { TIntegrationGoogleSheets } from "@formbricks/types/integration/google-sheet";
import { TIntegrationNotion, TIntegrationNotionConfigData } from "@formbricks/types/integration/notion";
import { TIntegrationSlack } from "@formbricks/types/integration/slack";
import { TResponseMeta } from "@formbricks/types/responses";
import { TSurvey, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";

const convertMetaObjectToString = (metadata: TResponseMeta): string => {
  let result: string[] = [];
  if (metadata.source) result.push(`Source: ${metadata.source}`);
  if (metadata.url) result.push(`URL: ${metadata.url}`);
  if (metadata.userAgent?.browser) result.push(`Browser: ${metadata.userAgent.browser}`);
  if (metadata.userAgent?.os) result.push(`OS: ${metadata.userAgent.os}`);
  if (metadata.userAgent?.device) result.push(`Device: ${metadata.userAgent.device}`);
  if (metadata.country) result.push(`Country: ${metadata.country}`);
  if (metadata.action) result.push(`Action: ${metadata.action}`);

  // Join all the elements in the result array with a newline for formatting
  return result.join("\n");
};

const processDataForIntegration = async (
  integrationType: TIntegrationType,
  data: TPipelineInput,
  survey: TSurvey,
  includeVariables: boolean,
  includeMetadata: boolean,
  includeHiddenFields: boolean,
  includeCreatedAt: boolean,
  questionIds: string[]
): Promise<string[][]> => {
  const ids =
    includeHiddenFields && survey.hiddenFields.fieldIds
      ? [...questionIds, ...survey.hiddenFields.fieldIds]
      : questionIds;
  const values = await extractResponses(integrationType, data, ids, survey);
  if (includeMetadata) {
    values[0].push(convertMetaObjectToString(data.response.meta));
    values[1].push("Metadata");
  }
  if (includeVariables) {
    survey.variables.forEach((variable) => {
      const value = data.response.variables[variable.id];
      if (value !== undefined) {
        values[0].push(String(data.response.variables[variable.id]));
        values[1].push(variable.name);
      }
    });
  }
  if (includeCreatedAt) {
    const date = new Date(data.response.createdAt);
    values[0].push(`${getFormattedDateTimeString(date)}`);
    values[1].push("Created At");
  }

  return values;
};

export const handleIntegrations = async (
  integrations: TIntegration[],
  data: TPipelineInput,
  survey: TSurvey
) => {
  for (const integration of integrations) {
    switch (integration.type) {
      case "googleSheets":
        const googleResult = await handleGoogleSheetsIntegration(
          integration as TIntegrationGoogleSheets,
          data,
          survey
        );
        if (!googleResult.ok) {
          logger.error(googleResult.error, "Error in google sheets integration");
        }
        break;
      case "slack":
        const slackResult = await handleSlackIntegration(integration as TIntegrationSlack, data, survey);
        if (!slackResult.ok) {
          logger.error(slackResult.error, "Error in slack integration");
        }
        break;
      case "airtable":
        const airtableResult = await handleAirtableIntegration(
          integration as TIntegrationAirtable,
          data,
          survey
        );
        if (!airtableResult.ok) {
          logger.error(airtableResult.error, "Error in airtable integration");
        }
        break;
      case "notion":
        const notionResult = await handleNotionIntegration(integration as TIntegrationNotion, data, survey);
        if (!notionResult.ok) {
          logger.error(notionResult.error, "Error in notion integration");
        }
        break;
    }
  }
};

const handleAirtableIntegration = async (
  integration: TIntegrationAirtable,
  data: TPipelineInput,
  survey: TSurvey
): Promise<Result<void, Error>> => {
  try {
    if (integration.config.data.length > 0) {
      for (const element of integration.config.data) {
        if (element.surveyId === data.surveyId) {
          const values = await processDataForIntegration(
            "airtable",
            data,
            survey,
            !!element.includeVariables,
            !!element.includeMetadata,
            !!element.includeHiddenFields,
            !!element.includeCreatedAt,
            element.questionIds
          );
          await airtableWriteData(integration.config.key, element, values);
        }
      }
    }

    return {
      ok: true,
      data: undefined,
    };
  } catch (err) {
    return {
      ok: false,
      error: err,
    };
  }
};

const handleGoogleSheetsIntegration = async (
  integration: TIntegrationGoogleSheets,
  data: TPipelineInput,
  survey: TSurvey
): Promise<Result<void, Error>> => {
  try {
    if (integration.config.data.length > 0) {
      for (const element of integration.config.data) {
        if (element.surveyId === data.surveyId) {
          const values = await processDataForIntegration(
            "googleSheets",
            data,
            survey,
            !!element.includeVariables,
            !!element.includeMetadata,
            !!element.includeHiddenFields,
            !!element.includeCreatedAt,
            element.questionIds
          );
          const integrationData = structuredClone(integration);
          integrationData.config.data.forEach((data) => {
            data.createdAt = new Date(data.createdAt);
          });

          await writeData(integrationData, element.spreadsheetId, values);
        }
      }
    }

    return {
      ok: true,
      data: undefined,
    };
  } catch (err) {
    return {
      ok: false,
      error: err,
    };
  }
};

const handleSlackIntegration = async (
  integration: TIntegrationSlack,
  data: TPipelineInput,
  survey: TSurvey
): Promise<Result<void, Error>> => {
  try {
    if (integration.config.data.length > 0) {
      for (const element of integration.config.data) {
        if (element.surveyId === data.surveyId) {
          const values = await processDataForIntegration(
            "slack",
            data,
            survey,
            !!element.includeVariables,
            !!element.includeMetadata,
            !!element.includeHiddenFields,
            !!element.includeCreatedAt,
            element.questionIds
          );
          await writeDataToSlack(integration.config.key, element.channelId, values, survey?.name);
        }
      }
    }

    return {
      ok: true,
      data: undefined,
    };
  } catch (err) {
    return {
      ok: false,
      error: err,
    };
  }
};

const extractResponses = async (
  integrationType: TIntegrationType,
  pipelineData: TPipelineInput,
  questionIds: string[],
  survey: TSurvey
): Promise<string[][]> => {
  const responses: string[] = [];
  const questions: string[] = [];

  for (const questionId of questionIds) {
    //check for hidden field Ids
    if (survey.hiddenFields.fieldIds?.includes(questionId)) {
      responses.push(processResponseData(pipelineData.response.data[questionId]));
      questions.push(questionId);
      continue;
    }
    const question = survey?.questions.find((q) => q.id === questionId);
    if (!question) {
      continue;
    }

    const responseValue = pipelineData.response.data[questionId];

    if (responseValue !== undefined) {
      let answer: typeof responseValue;
      if (question.type === TSurveyQuestionTypeEnum.PictureSelection) {
        const selectedChoiceIds = responseValue as string[];
        answer = question?.choices
          .filter((choice) => selectedChoiceIds.includes(choice.id))
          .map((choice) => choice.imageUrl)
          .join("\n");
      } else {
        answer = responseValue;
      }

      responses.push(processResponseData(answer));
    } else {
      responses.push("");
    }
    // Create emptyResponseObject with same keys but empty string values
    const emptyResponseObject = Object.keys(pipelineData.response.data).reduce(
      (acc, key) => {
        acc[key] = "";
        return acc;
      },
      {} as Record<string, string>
    );
    questions.push(
      parseRecallInfo(
        getLocalizedValue(question?.headline, "default"),
        integrationType === "slack" ? pipelineData.response.data : emptyResponseObject,
        integrationType === "slack" ? pipelineData.response.variables : {}
      ) || ""
    );
  }

  return [responses, questions];
};

const handleNotionIntegration = async (
  integration: TIntegrationNotion,
  data: TPipelineInput,
  surveyData: TSurvey
): Promise<Result<void, Error>> => {
  try {
    if (integration.config.data.length > 0) {
      for (const element of integration.config.data) {
        if (element.surveyId === data.surveyId) {
          const properties = buildNotionPayloadProperties(element.mapping, data, surveyData);
          await writeNotionData(element.databaseId, properties, integration.config);
        }
      }
    }

    return {
      ok: true,
      data: undefined,
    };
  } catch (err) {
    return {
      ok: false,
      error: err,
    };
  }
};

const buildNotionPayloadProperties = (
  mapping: TIntegrationNotionConfigData["mapping"],
  data: TPipelineInput,
  surveyData: TSurvey
) => {
  const properties: any = {};
  const responses = data.response.data;

  const mappingQIds = mapping
    .filter((m) => m.question.type === TSurveyQuestionTypeEnum.PictureSelection)
    .map((m) => m.question.id);

  Object.keys(responses).forEach((resp) => {
    if (mappingQIds.find((qId) => qId === resp)) {
      const selectedChoiceIds = responses[resp] as string[];
      const pictureQuestion = surveyData.questions.find((q) => q.id === resp);

      responses[resp] = (pictureQuestion as any)?.choices
        .filter((choice) => selectedChoiceIds.includes(choice.id))
        .map((choice) => choice.imageUrl);
    }
  });

  mapping.forEach((map) => {
    if (map.question.id === "metadata") {
      properties[map.column.name] = {
        [map.column.type]: getValue(map.column.type, convertMetaObjectToString(data.response.meta)) || null,
      };
    } else if (map.question.id === "createdAt") {
      properties[map.column.name] = {
        [map.column.type]: getValue(map.column.type, data.response.createdAt) || null,
      };
    } else {
      const value = responses[map.question.id];
      properties[map.column.name] = {
        [map.column.type]: getValue(map.column.type, value) || null,
      };
    }
  });

  return properties;
};

// notion requires specific payload for each column type
// * TYPES NOT SUPPORTED BY NOTION API - rollup, created_by, created_time, last_edited_by, or last_edited_time
const getValue = (colType: string, value: string | string[] | Date | number | Record<string, string>) => {
  try {
    switch (colType) {
      case "select":
        if (!value) return null;
        if (typeof value === "string") {
          // Replace commas
          const sanitizedValue = value.replace(/,/g, "");
          return {
            name: sanitizedValue,
          };
        }
      case "multi_select":
        if (Array.isArray(value)) {
          return value.map((v: string) => ({ name: v.replace(/,/g, "") }));
        }
      case "title":
        return [
          {
            text: {
              content: value,
            },
          },
        ];
      case "rich_text":
        if (typeof value === "string") {
          return [
            {
              text: {
                content:
                  value.length > NOTION_RICH_TEXT_LIMIT ? truncateText(value, NOTION_RICH_TEXT_LIMIT) : value,
              },
            },
          ];
        }
        return [
          {
            text: {
              content: value,
            },
          },
        ];
      case "status":
        return {
          name: value,
        };
      case "checkbox":
        return value === "accepted" || value === "clicked";
      case "date":
        return {
          start: value,
        };
      case "email":
        return value;
      case "number":
        return parseInt(value as string);
      case "phone_number":
        return value;
      case "url":
        return typeof value === "string" ? value : (value as string[]).join(", ");
    }
  } catch (error) {
    logger.error(error, "Payload build failed!");
    throw new Error("Payload build failed!");
  }
};
