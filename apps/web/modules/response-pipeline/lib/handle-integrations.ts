import type { TResponsePipelineJobData } from "@formbricks/jobs";
import { logger } from "@formbricks/logger";
import { Result } from "@formbricks/types/error-handlers";
import { TIntegration, TIntegrationType } from "@formbricks/types/integration";
import { TIntegrationAirtable } from "@formbricks/types/integration/airtable";
import { TIntegrationGoogleSheets } from "@formbricks/types/integration/google-sheet";
import { TIntegrationNotion, TIntegrationNotionConfigData } from "@formbricks/types/integration/notion";
import { TIntegrationSlack } from "@formbricks/types/integration/slack";
import { TResponseDataValue, TResponseMeta } from "@formbricks/types/responses";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { writeData as airtableWriteData } from "@/lib/airtable/service";
import { NOTION_RICH_TEXT_LIMIT } from "@/lib/constants";
import { writeData } from "@/lib/googleSheet/service";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { writeData as writeNotionData } from "@/lib/notion/service";
import { processResponseData } from "@/lib/responses";
import { writeDataToSlack } from "@/lib/slack/service";
import { getElementsFromBlocks } from "@/lib/survey/utils";
import { getFormattedDateTimeString } from "@/lib/utils/datetime";
import { parseRecallInfo } from "@/lib/utils/recall";
import { truncateText } from "@/lib/utils/strings";
import { resolveStorageUrlAuto } from "@/modules/storage/utils";

const convertMetaObjectToString = (metadata: TResponseMeta): string => {
  let result: string[] = [];
  if (metadata.source) result.push(`Source: ${metadata.source}`);
  if (metadata.url) result.push(`URL: ${metadata.url}`);
  if (metadata.userAgent?.browser) result.push(`Browser: ${metadata.userAgent.browser}`);
  if (metadata.userAgent?.os) result.push(`OS: ${metadata.userAgent.os}`);
  if (metadata.userAgent?.device) result.push(`Device: ${metadata.userAgent.device}`);
  if (metadata.country) result.push(`Country: ${metadata.country}`);
  if (metadata.action) result.push(`Action: ${metadata.action}`);
  if (metadata.ipAddress) result.push(`IP Address: ${metadata.ipAddress}`);

  // Join all the elements in the result array with a newline for formatting
  return result.join("\n");
};

interface TIntegrationFieldSelection {
  elementIds: string[];
  includeCreatedAt: boolean;
  includeHiddenFields: boolean;
  includeMetadata: boolean;
  includeVariables: boolean;
}

const toIntegrationFieldSelection = (config: {
  elementIds: string[];
  includeCreatedAt?: boolean | null;
  includeHiddenFields?: boolean | null;
  includeMetadata?: boolean | null;
  includeVariables?: boolean | null;
}): TIntegrationFieldSelection => ({
  elementIds: config.elementIds,
  includeCreatedAt: Boolean(config.includeCreatedAt),
  includeHiddenFields: Boolean(config.includeHiddenFields),
  includeMetadata: Boolean(config.includeMetadata),
  includeVariables: Boolean(config.includeVariables),
});

const processDataForIntegration = async (
  integrationType: TIntegrationType,
  data: TResponsePipelineJobData,
  survey: TSurvey,
  selection: TIntegrationFieldSelection
): Promise<{
  responses: string[];
  elements: string[];
}> => {
  const { elementIds, includeCreatedAt, includeHiddenFields, includeMetadata, includeVariables } = selection;
  const ids =
    includeHiddenFields && survey.hiddenFields.fieldIds
      ? [...elementIds, ...survey.hiddenFields.fieldIds]
      : elementIds;
  const { responses, elements } = await extractResponses(integrationType, data, ids, survey);

  if (includeMetadata) {
    responses.push(convertMetaObjectToString(data.response.meta));
    elements.push("Metadata");
  }
  if (includeVariables) {
    survey.variables?.forEach((variable) => {
      const value = data.response.variables[variable.id];
      if (value !== undefined) {
        responses.push(String(data.response.variables[variable.id]));
        elements.push(variable.name);
      }
    });
  }
  if (includeCreatedAt) {
    const date = new Date(data.response.createdAt);
    responses.push(`${getFormattedDateTimeString(date)}`);
    elements.push("Created At");
  }

  return {
    responses,
    elements,
  };
};

export const handleIntegrations = async (
  integrations: TIntegration[],
  data: TResponsePipelineJobData,
  survey: TSurvey
) => {
  for (const integration of integrations) {
    switch (integration.type) {
      case "googleSheets": {
        const googleResult = await handleGoogleSheetsIntegration(
          integration as TIntegrationGoogleSheets,
          data,
          survey
        );
        if (!googleResult.ok) {
          logger.error(googleResult.error, "Error in google sheets integration");
        }
        break;
      }
      case "slack": {
        const slackResult = await handleSlackIntegration(integration as TIntegrationSlack, data, survey);
        if (!slackResult.ok) {
          logger.error(slackResult.error, "Error in slack integration");
        }
        break;
      }
      case "airtable": {
        const airtableResult = await handleAirtableIntegration(
          integration as TIntegrationAirtable,
          data,
          survey
        );
        if (!airtableResult.ok) {
          logger.error(airtableResult.error, "Error in airtable integration");
        }
        break;
      }
      case "notion": {
        const notionResult = await handleNotionIntegration(integration as TIntegrationNotion, data, survey);
        if (!notionResult.ok) {
          logger.error(notionResult.error, "Error in notion integration");
        }
        break;
      }
    }
  }
};

const handleAirtableIntegration = async (
  integration: TIntegrationAirtable,
  data: TResponsePipelineJobData,
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
            toIntegrationFieldSelection(element)
          );
          await airtableWriteData(integration.config.key, element, values.responses, values.elements);
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
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
};

const handleGoogleSheetsIntegration = async (
  integration: TIntegrationGoogleSheets,
  data: TResponsePipelineJobData,
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
            toIntegrationFieldSelection(element)
          );
          const integrationData = structuredClone(integration);
          integrationData.config.data.forEach((data) => {
            data.createdAt = new Date(data.createdAt);
          });

          await writeData(integrationData, element.spreadsheetId, values.responses, values.elements);
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
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
};

const handleSlackIntegration = async (
  integration: TIntegrationSlack,
  data: TResponsePipelineJobData,
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
            toIntegrationFieldSelection(element)
          );
          await writeDataToSlack(
            integration.config.key,
            element.channelId,
            values.responses,
            values.elements,
            survey?.name
          );
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
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
};

// Helper to process a single element's response for integrations
const processElementResponse = (
  element: ReturnType<typeof getElementsFromBlocks>[number],
  responseValue: TResponseDataValue
): string => {
  if (responseValue === undefined) {
    return "";
  }

  if (element.type === TSurveyElementTypeEnum.PictureSelection) {
    const selectedChoiceIds = responseValue as string[];
    return element.choices
      .filter((choice) => selectedChoiceIds.includes(choice.id))
      .map((choice) => resolveStorageUrlAuto(choice.imageUrl))
      .join("\n");
  }

  if (element.type === TSurveyElementTypeEnum.FileUpload && Array.isArray(responseValue)) {
    return responseValue
      .map((url) => (typeof url === "string" ? resolveStorageUrlAuto(url) : url))
      .join("; ");
  }

  return processResponseData(responseValue);
};

// Helper to create empty response object for non-slack integrations
const createEmptyResponseObject = (responseData: Record<string, unknown>): Record<string, string> => {
  return Object.keys(responseData).reduce(
    (acc, key) => {
      acc[key] = "";
      return acc;
    },
    {} as Record<string, string>
  );
};

const extractResponses = async (
  integrationType: TIntegrationType,
  pipelineData: TResponsePipelineJobData,
  elementIds: string[],
  survey: TSurvey
): Promise<{
  responses: string[];
  elements: string[];
}> => {
  const responses: string[] = [];
  const elements: string[] = [];
  const surveyElements = getElementsFromBlocks(survey.blocks);
  const emptyResponseObject = createEmptyResponseObject(pipelineData.response.data);

  for (const elementId of elementIds) {
    // Check for hidden field Ids
    if (survey.hiddenFields.fieldIds?.includes(elementId)) {
      responses.push(processResponseData(pipelineData.response.data[elementId]));
      elements.push(elementId);
      continue;
    }

    const element = surveyElements.find((q) => q.id === elementId);
    if (!element) {
      continue;
    }

    const responseValue = pipelineData.response.data[elementId];
    responses.push(processElementResponse(element, responseValue));

    const responseDataForRecall =
      integrationType === "slack" ? pipelineData.response.data : emptyResponseObject;
    const variablesForRecall = integrationType === "slack" ? pipelineData.response.variables : {};

    elements.push(
      parseRecallInfo(
        getTextContent(getLocalizedValue(element.headline, "default")),
        responseDataForRecall,
        variablesForRecall
      ) || ""
    );
  }

  return { responses, elements };
};

const handleNotionIntegration = async (
  integration: TIntegrationNotion,
  data: TResponsePipelineJobData,
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
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
};

const buildNotionPayloadProperties = (
  mapping: TIntegrationNotionConfigData["mapping"],
  data: TResponsePipelineJobData,
  surveyData: TSurvey
) => {
  const properties: any = {};
  const responses = data.response.data;

  const surveyElements = getElementsFromBlocks(surveyData.blocks);
  const pictureSelectionElementIds = new Set(
    mapping.filter((m) => m.element.type === TSurveyElementTypeEnum.PictureSelection).map((m) => m.element.id)
  );

  Object.keys(responses).forEach((resp) => {
    if (pictureSelectionElementIds.has(resp)) {
      const selectedChoiceIds = responses[resp] as string[];
      const pictureElement = surveyElements.find((el) => el.id === resp);

      responses[resp] = (pictureElement as any)?.choices
        .filter((choice: { id: string; imageUrl: string }) => selectedChoiceIds.includes(choice.id))
        .map((choice: { id: string; imageUrl: string }) => resolveStorageUrlAuto(choice.imageUrl));
    }
  });

  mapping.forEach((map) => {
    if (map.element.id === "metadata") {
      properties[map.column.name] = {
        [map.column.type]: getValue(map.column.type, convertMetaObjectToString(data.response.meta)) || null,
      };
    } else if (map.element.id === "createdAt") {
      properties[map.column.name] = {
        [map.column.type]: getValue(map.column.type, data.response.createdAt) || null,
      };
    } else {
      const value = responses[map.element.id];
      properties[map.column.name] = {
        [map.column.type]: getValue(map.column.type, value) || null,
      };
    }
  });

  return properties;
};

// notion requires specific payload for each column type
// * TYPES NOT SUPPORTED BY NOTION API - rollup, created_by, created_time, last_edited_by, or last_edited_time
type TNotionValueInput = string | string[] | Date | number | Record<string, string> | undefined;

const getSelectValue = (value: TNotionValueInput) => {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  return {
    name: value.replaceAll(",", ""),
  };
};

const getMultiSelectValue = (value: TNotionValueInput) => {
  if (!Array.isArray(value)) {
    return null;
  }

  return value.map((entry: string) => ({ name: entry.replaceAll(",", "") }));
};

const getTitleValue = (value: TNotionValueInput) => [
  {
    text: {
      content: value,
    },
  },
];

const getRichTextValue = (value: TNotionValueInput) => {
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

  if (Array.isArray(value)) {
    const content = value.join("\n");
    return [
      {
        text: {
          content:
            content.length > NOTION_RICH_TEXT_LIMIT ? truncateText(content, NOTION_RICH_TEXT_LIMIT) : content,
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
};

const getUrlValue = (value: TNotionValueInput) => {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return undefined;
};

const getValue = (colType: string, value: TNotionValueInput) => {
  try {
    switch (colType) {
      case "select":
        return getSelectValue(value);
      case "multi_select":
        return getMultiSelectValue(value);
      case "title":
        return getTitleValue(value);
      case "rich_text":
        return getRichTextValue(value);
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
        return Number.parseInt(value as string, 10);
      case "phone_number":
        return value;
      case "url":
        return getUrlValue(value);
      default:
        return null;
    }
  } catch (error) {
    logger.error(error, "Payload build failed!");
    throw new Error("Payload build failed!");
  }
};
