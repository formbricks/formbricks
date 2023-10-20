import { writeData as airtableWriteData } from "@formbricks/lib/airtable/service";
import { writeData } from "@formbricks/lib/googleSheet/service";
import { writeData as writeNotionData } from "@formbricks/lib/notion/service";
import { getSurvey } from "@formbricks/lib/survey/service";
import { TIntegration, TNotionConfigData, TNotionIntegration } from "@formbricks/types/v1/integrations";
import { TPipelineInput } from "@formbricks/types/v1/pipelines";
import { TIntegrationGoogleSheets } from "@formbricks/types/v1/integration/googleSheet";
import { TIntegrationAirtable } from "@formbricks/types/v1/integration/airtable";

export async function handleIntegrations(integrations: TIntegration[], data: TPipelineInput) {
  for (const integration of integrations) {
    switch (integration.type) {
      case "googleSheets":
        await handleGoogleSheetsIntegration(integration as TIntegrationGoogleSheets, data);
        break;
      case "airtable":
        await handleAirtableIntegration(integration as TIntegrationAirtable, data);
        break;
      case "notion":
        await handleNotionIntegration(integration as TNotionIntegration, data);
        break;
    }
  }
}

async function handleAirtableIntegration(integration: TIntegrationAirtable, data: TPipelineInput) {
  if (integration.config.data.length > 0) {
    for (const element of integration.config.data) {
      if (element.surveyId === data.surveyId) {
        const values = await extractResponses(data, element.questionIds);

        await airtableWriteData(integration.config.key, element, values);
      }
    }
  }
}

async function handleGoogleSheetsIntegration(integration: TIntegrationGoogleSheets, data: TPipelineInput) {
  if (integration.config.data.length > 0) {
    for (const element of integration.config.data) {
      if (element.surveyId === data.surveyId) {
        const values = await extractResponses(data, element.questionIds);
        await writeData(integration.config.key, element.spreadsheetId, values);
      }
    }
  }
}

async function extractResponses(data: TPipelineInput, questionIds: string[]): Promise<string[][]> {
  const responses: string[] = [];
  const questions: string[] = [];
  const survey = await getSurvey(data.surveyId);

  for (const questionId of questionIds) {
    const responseValue = data.response.data[questionId];

    if (responseValue !== undefined) {
      responses.push(Array.isArray(responseValue) ? responseValue.join(",") : String(responseValue));
    } else {
      responses.push("");
    }

    const question = survey?.questions.find((q) => q.id === questionId);
    questions.push(question?.headline || "");
  }

  return [responses, questions];
}

async function handleNotionIntegration(integration: TNotionIntegration, data: TPipelineInput) {
  if (integration.config.data.length > 0) {
    for (const element of integration.config.data) {
      if (element.surveyId === data.surveyId) {
        const properties = buildNotionPayloadProperties(element.mapping, data);
        await writeNotionData(element.databaseId, properties, integration.config);
      }
    }
  }
}

function buildNotionPayloadProperties(mapping: TNotionConfigData["mapping"], data: TPipelineInput) {
  const properties: any = {};
  const responses = data.response.data;

  mapping.forEach((map) => {
    const value = responses[map.question.id];

    properties[map.column.name] = {
      [map.column.type]: getValue(map.column.type, value),
    };
  });

  return properties;
}

// notion requires specific payload for each column type
// * TYPES NOT SUPPORTED BY NOTION API - rollup, created_by, created_time, last_edited_by, or last_edited_time
function getValue(colType: string, value: string | string[] | number) {
  try {
    switch (colType) {
      case "select":
        return {
          name: value,
        };
      case "multi_select":
        return (value as []).map((v: string) => ({ name: v }));
      case "title":
        return [
          {
            text: {
              content: value,
            },
          },
        ];
      case "rich_text":
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
        return value === "accepted";
      case "date":
        return {
          start: new Date(value as string).toISOString().substring(0, 10),
        };
      case "email":
        return value;
      case "number":
        return parseInt(value as string);
      case "phone_number":
        return value;
      case "url":
        return value;
    }
  } catch (error) {
    throw new Error("Payload build failed!");
  }
}
