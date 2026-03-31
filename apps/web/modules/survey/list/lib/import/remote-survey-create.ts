import { logger } from "@formbricks/logger";
import { ValidationError } from "@formbricks/types/errors";
import { env } from "@/lib/env";
import { type TSurveyExportPayload } from "../export-survey";
import { addLanguageLabels } from "./normalize-survey";
import { parseSurveyPayload } from "./parse-payload";

interface TRemoteCreateResult {
  surveyId: string;
  surveyUrl: string;
}

interface TRemoteCreateContext {
  importRunId?: string;
  requestedByUserId?: string;
}

const normalizeHost = (host: string): string => host.replace(/\/+$/, "");

const getRemoteConfig = () => {
  if (!env.SURVEY_IMPORT_TARGET_HOST) {
    throw new Error("SURVEY_IMPORT_TARGET_HOST is not set");
  }
  if (!env.SURVEY_IMPORT_TARGET_ENVIRONMENT_ID) {
    throw new Error("SURVEY_IMPORT_TARGET_ENVIRONMENT_ID is not set");
  }
  if (!env.SURVEY_IMPORT_TARGET_API_KEY) {
    throw new Error("SURVEY_IMPORT_TARGET_API_KEY is not set");
  }

  return {
    host: normalizeHost(env.SURVEY_IMPORT_TARGET_HOST),
    environmentId: env.SURVEY_IMPORT_TARGET_ENVIRONMENT_ID,
    apiKey: env.SURVEY_IMPORT_TARGET_API_KEY,
  };
};

const formatRemoteErrorDetails = (details: unknown): string[] => {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return [];
  }

  return Object.entries(details as Record<string, unknown>).flatMap(([field, value]) => {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return [];
      }
      return `${field}: ${value.map(String).join(", ")}`;
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return `${field}: ${String(value)}`;
    }
    return [];
  });
};

const isRemoteLanguageCompatibilityError = (details: string[]): boolean =>
  details.some(
    (detail) =>
      detail.includes("languages.") &&
      detail.includes(".language") &&
      detail.includes("expected object") &&
      detail.includes("received undefined")
  );

const extractRemoteErrorMessage = async (response: Response): Promise<string> => {
  try {
    const body = await response.json();
    if (typeof body?.message === "string" && body.message.length > 0) {
      const details = formatRemoteErrorDetails(body?.details);
      const compatibilityHint = isRemoteLanguageCompatibilityError(details)
        ? [
            "",
            "Remote target is using an older survey management API that cannot map imported language codes yet.",
            "Deploy the target instance with the multilingual remote import compatibility update and try again.",
          ].join("\n")
        : "";
      return details.length > 0
        ? `${body.message}\n${details.join("\n")}${compatibilityHint}`
        : `${body.message}${compatibilityHint}`;
    }
    if (typeof body?.error?.message === "string" && body.error.message.length > 0) {
      return body.error.message;
    }
  } catch {}

  return `Remote API request failed with status ${response.status}`;
};

export const createRemoteSurveyFromPayload = async (
  surveyData: TSurveyExportPayload,
  newName: string,
  context?: TRemoteCreateContext
): Promise<TRemoteCreateResult> => {
  logger.info(
    {
      importRunId: context?.importRunId,
      requestedByUserId: context?.requestedByUserId,
      newName,
    },
    "Survey import: starting remote survey creation"
  );

  const parsed = parseSurveyPayload(surveyData);
  if ("error" in parsed) {
    const details = parsed.details?.length ? `: ${parsed.details.join(", ")}` : "";
    logger.warn(
      {
        importRunId: context?.importRunId,
        parseError: parsed.error,
        details: parsed.details,
      },
      "Survey import: remote payload validation failed"
    );
    throw new ValidationError(`${parsed.error}${details}`);
  }

  const config = getRemoteConfig();
  const hasMultipleLanguages = parsed.exportedLanguages.some((language) => !language.default);
  const nonDefaultLanguageCodes = parsed.exportedLanguages
    .filter((language) => !language.default)
    .map((language) => language.code);
  const surveyInputWithLanguageLabels = addLanguageLabels(parsed.surveyInput, nonDefaultLanguageCodes);

  const requestPayload: Record<string, unknown> = {
    ...surveyInputWithLanguageLabels,
    environmentId: config.environmentId,
    name: newName,
  };
  if (hasMultipleLanguages) {
    requestPayload.languages = parsed.exportedLanguages;
  } else {
    delete requestPayload.languages;
  }

  const response = await fetch(`${config.host}/api/v1/management/surveys`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
    },
    body: JSON.stringify(requestPayload),
  });

  if (!response.ok) {
    logger.warn(
      {
        importRunId: context?.importRunId,
        targetHost: config.host,
        targetEnvironmentId: config.environmentId,
        status: response.status,
      },
      "Survey import: remote API returned non-OK response"
    );
    throw new ValidationError(await extractRemoteErrorMessage(response));
  }

  const responseBody = (await response.json()) as { data?: { id?: string } };
  const surveyId = responseBody?.data?.id;

  if (!surveyId) {
    throw new Error("Remote API did not return a survey id");
  }

  const result = {
    surveyId,
    surveyUrl: `${config.host}/environments/${config.environmentId}/surveys/${surveyId}/edit`,
  };

  logger.info(
    {
      importRunId: context?.importRunId,
      targetHost: config.host,
      targetEnvironmentId: config.environmentId,
      surveyId: result.surveyId,
    },
    "Survey import: remote survey created successfully"
  );

  return result;
};
