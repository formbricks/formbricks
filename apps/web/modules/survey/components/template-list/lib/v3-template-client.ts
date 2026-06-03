import type { TSurveyType } from "@formbricks/types/surveys/types";
import type { TTemplate } from "@formbricks/types/templates";
import type { TUserLocale } from "@formbricks/types/user";
import { V3ApiError, parseV3ApiError } from "@/modules/api/lib/v3-client";
import {
  type TV3TemplateSurveyCreatePayload,
  buildV3SurveyCreatePayloadFromTemplate,
} from "./template-to-v3";

type TV3SurveyCreateResponse = {
  data: {
    id: string;
  };
};

type TV3SurveyValidationResponse = {
  data: {
    valid: boolean;
    invalid_params: {
      name: string;
      reason: string;
    }[];
  };
};

async function validateV3TemplateSurveyCreatePayload(payload: TV3TemplateSurveyCreatePayload): Promise<void> {
  const response = await fetch("/api/v3/surveys/validate", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      operation: "create",
      data: payload,
    }),
  });

  if (!response.ok) {
    throw await parseV3ApiError(response);
  }

  const body = (await response.json()) as TV3SurveyValidationResponse;
  if (body.data.valid) {
    return;
  }

  const firstInvalidParam = body.data.invalid_params[0];
  throw new V3ApiError({
    status: 400,
    detail: firstInvalidParam
      ? `Invalid template survey document: ${firstInvalidParam.name}: ${firstInvalidParam.reason}`
      : "Invalid template survey document",
    code: "bad_request",
    invalid_params: body.data.invalid_params,
  });
}

async function createV3TemplateSurvey(
  payload: TV3TemplateSurveyCreatePayload
): Promise<TV3SurveyCreateResponse["data"]> {
  const response = await fetch("/api/v3/surveys", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw await parseV3ApiError(response);
  }

  const body = (await response.json()) as TV3SurveyCreateResponse;
  return body.data;
}

export async function createSurveyFromTemplate({
  template,
  workspaceId,
  surveyType,
  defaultLanguage,
}: {
  template: TTemplate;
  workspaceId: string;
  surveyType: TSurveyType;
  defaultLanguage: TUserLocale;
}): Promise<TV3SurveyCreateResponse["data"]> {
  const payload = buildV3SurveyCreatePayloadFromTemplate({
    template,
    workspaceId,
    surveyType,
    defaultLanguage,
  });

  await validateV3TemplateSurveyCreatePayload(payload);
  return await createV3TemplateSurvey(payload);
}
