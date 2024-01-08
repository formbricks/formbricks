import { writeData as airtableWriteData } from "@formbricks/lib/airtable/service";
import { writeData } from "@formbricks/lib/googleSheet/service";
import { writeData as writeNotionData } from "@formbricks/lib/notion/service";
import { getSurvey } from "@formbricks/lib/survey/service";
import { TIntegration } from "@formbricks/types/integration";
import { TIntegrationAirtable } from "@formbricks/types/integration/airtable";
import { TIntegrationGoogleSheets } from "@formbricks/types/integration/googleSheet";
import { TIntegrationNotion, TIntegrationNotionConfigData } from "@formbricks/types/integration/notion";
import { TPipelineInput } from "@formbricks/types/pipelines";
import { TSurvey, TSurveyQuestionType } from "@formbricks/types/surveys";

export async function handleIntegrations(
  integrations: TIntegration[],
  data: TPipelineInput,
  surveyData: TSurvey
) {
  for (const integration of integrations) {
    switch (integration.type) {
      case "googleSheets":
        await handleGoogleSheetsIntegration(integration as TIntegrationGoogleSheets, data);
        break;
      case "airtable":
        await handleAirtableIntegration(integration as TIntegrationAirtable, data);
        break;
      case "notion":
        await handleNotionIntegration(integration as TIntegrationNotion, data, surveyData);
        break;
    }
  }
}

async function handleAirtableIntegration(integration: TIntegrationAirtable, data: TPipelineInput) {
  if (integration.config.data.length > 0) {
    for (const element of integration.config.data) {
      if (element.surveyId === data.surveyId) {
        const values = await extractResponses(data, element.questionIds as string[]);

        await airtableWriteData(integration.config.key, element, values);
      }
    }
  }
}

async function handleGoogleSheetsIntegration(integration: TIntegrationGoogleSheets, data: TPipelineInput) {
  if (integration.config.data.length > 0) {
    for (const element of integration.config.data) {
      if (element.surveyId === data.surveyId) {
        const values = await extractResponses(data, element.questionIds as string[]);
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

async function handleNotionIntegration(
  integration: TIntegrationNotion,
  data: TPipelineInput,
  surveyData: TSurvey
) {
  if (integration.config.data.length > 0) {
    for (const element of integration.config.data) {
      if (element.surveyId === data.surveyId) {
        const properties = buildNotionPayloadProperties(element.mapping, data, surveyData);
        await writeNotionData(element.databaseId, properties, integration.config);
      }
    }
  }
}

function buildNotionPayloadProperties(
  mapping: TIntegrationNotionConfigData["mapping"],
  data: TPipelineInput,
  surveyData: TSurvey
) {
  const properties: any = {};
  const responses = data.response.data;

  const mappingQIds = mapping
    .filter((m) => m.question.type === TSurveyQuestionType.PictureSelection)
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
        return value === "accepted" || value === "clicked";
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
        return typeof value === "string" ? value : (value as string[]).join(", ");
    }
  } catch (error) {
    throw new Error("Payload build failed!");
  }
}
