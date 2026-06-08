import type { TSurveyType } from "@formbricks/types/surveys/types";
import type { TUserLocale } from "@formbricks/types/user";
import { parseV3ApiError } from "@/modules/api/lib/v3-client";

type TV3SurveyCreateResponse = {
  data: {
    id: string;
  };
};

export type TV3TemplateSource = "catalog" | "custom" | "xm";

export type TCreateSurveyFromTemplateInput = {
  workspaceId: string;
  templateId: string;
  source: TV3TemplateSource;
  surveyType: TSurveyType;
  defaultLanguage: TUserLocale;
};

export async function createSurveyFromTemplate({
  workspaceId,
  templateId,
  source,
  surveyType,
  defaultLanguage,
}: TCreateSurveyFromTemplateInput): Promise<TV3SurveyCreateResponse["data"]> {
  const response = await fetch("/api/v3/surveys/templates", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      workspaceId,
      templateId,
      source,
      surveyType,
      defaultLanguage,
    }),
  });

  if (!response.ok) {
    throw await parseV3ApiError(response);
  }

  const body = (await response.json()) as TV3SurveyCreateResponse;
  return body.data;
}
