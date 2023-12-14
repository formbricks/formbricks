import { writeData as airtableWriteData } from "@formbricks/lib/airtable/service";
import { writeData } from "@formbricks/lib/googleSheet/service";
import { getSurvey } from "@formbricks/lib/survey/service";
import { TIntegration } from "@formbricks/types/integration";
import { TIntegrationAirtable } from "@formbricks/types/integration/airtable";
import { TIntegrationGoogleSheets } from "@formbricks/types/integration/googleSheet";
import { TPipelineInput } from "@formbricks/types/pipelines";

export async function handleIntegrations(integrations: TIntegration[], data: TPipelineInput) {
  for (const integration of integrations) {
    switch (integration.type) {
      case "googleSheets":
        await handleGoogleSheetsIntegration(integration as TIntegrationGoogleSheets, data);
        break;
      case "airtable":
        await handleAirtableIntegration(integration as TIntegrationAirtable, data);
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
