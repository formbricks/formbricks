import { createId } from "@paralleldrive/cuid2";
import { z } from "zod";
import { ValidationError } from "@formbricks/types/errors";
import { TSurvey, TSurveyCreateInput, ZSurvey, ZSurveyCreateInput } from "@formbricks/types/surveys/types";
import type { TV3SurveyCreateBody, TV3SurveyPatchBody } from "./schemas";

const V3_SURVEY_SYSTEM_DEFAULTS = {
  displayOption: "displayOnce",
  autoClose: null,
  triggers: [],
  recontactDays: null,
  displayLimit: null,
  questions: [],
  followUps: [],
  delay: 0,
  autoComplete: null,
  projectOverwrites: null,
  styling: null,
  showLanguageSwitch: null,
  surveyClosedMessage: null,
  segment: null,
  singleUse: null,
  isVerifyEmailEnabled: false,
  recaptcha: null,
  isSingleResponsePerEmailEnabled: false,
  isBackButtonHidden: false,
  isAutoProgressingEnabled: false,
  isCaptureIpEnabled: false,
  pin: null,
  displayPercentage: null,
  languages: [],
  metadata: {},
  slug: null,
  customHeadScripts: null,
  customHeadScriptsMode: null,
} satisfies Omit<
  TSurvey,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "environmentId"
  | "createdBy"
  | "name"
  | "type"
  | "status"
  | "welcomeCard"
  | "blocks"
  | "endings"
  | "hiddenFields"
  | "variables"
>;

function formatValidationError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return `${path}${issue.message}`;
    })
    .join("; ");
}

function toValidationError(error: z.ZodError): ValidationError {
  return new ValidationError(formatValidationError(error));
}

export function normalizeV3SurveyCreateInput(
  body: TV3SurveyCreateBody,
  createdBy: string | null
): TSurveyCreateInput {
  return {
    ...V3_SURVEY_SYSTEM_DEFAULTS,
    name: body.name,
    type: body.type ?? "link",
    status: body.status ?? "draft",
    welcomeCard: body.welcomeCard ?? {
      enabled: false,
    },
    blocks: body.blocks,
    endings: body.endings ?? [],
    hiddenFields: body.hiddenFields ?? { enabled: false },
    variables: body.variables ?? [],
    createdBy,
  };
}

export function buildV3SurveyCreateInput(
  body: TV3SurveyCreateBody,
  createdBy: string | null
): TSurveyCreateInput {
  const input = normalizeV3SurveyCreateInput(body, createdBy);
  const result = ZSurveyCreateInput.safeParse(input);

  if (!result.success) {
    throw toValidationError(result.error);
  }

  return result.data;
}

export function buildV3SurveyPreview(
  environmentId: string,
  createInput: TSurveyCreateInput,
  surveyId = createId()
): TSurvey {
  const now = new Date();
  const surveyCandidate: TSurvey = {
    ...V3_SURVEY_SYSTEM_DEFAULTS,
    id: surveyId,
    createdAt: now,
    updatedAt: now,
    environmentId,
    createdBy: createInput.createdBy ?? null,
    name: createInput.name,
    type: createInput.type ?? "link",
    status: createInput.status ?? "draft",
    welcomeCard: createInput.welcomeCard ?? {
      enabled: false,
    },
    blocks: createInput.blocks ?? [],
    endings: createInput.endings ?? [],
    hiddenFields: createInput.hiddenFields ?? { enabled: false },
    variables: createInput.variables ?? [],
  };

  const result = ZSurvey.safeParse(surveyCandidate);
  if (!result.success) {
    throw toValidationError(result.error);
  }

  return result.data;
}

export function applyV3SurveyPatch(currentSurvey: TSurvey, patch: TV3SurveyPatchBody): TSurvey {
  const mergedSurvey: TSurvey = {
    ...currentSurvey,
    ...patch,
    updatedAt: new Date(),
  };

  const result = ZSurvey.safeParse(mergedSurvey);
  if (!result.success) {
    throw toValidationError(result.error);
  }

  return result.data;
}
