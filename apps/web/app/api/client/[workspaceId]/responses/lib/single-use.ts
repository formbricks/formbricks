import "server-only";
import { logger } from "@formbricks/logger";
import { TResponseInput } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { responses } from "@/app/lib/api/response";
import { ENCRYPTION_KEY } from "@/lib/constants";
import { symmetricDecrypt } from "@/lib/crypto";
import { validateSurveySingleUseLinkParams } from "@/lib/utils/single-use-surveys";

type TSingleUseResponseInput = Pick<TResponseInput, "singleUseId" | "meta">;

type TValidateSingleUseResponseInputResult = { singleUseId: string } | { response: Response } | null;

export const validateSingleUseResponseInput = (
  survey: TSurvey,
  environmentId: string,
  responseInput: TSingleUseResponseInput
): TValidateSingleUseResponseInputResult => {
  if (survey.type !== "link" || !survey.singleUse?.enabled) {
    return null;
  }

  if (!ENCRYPTION_KEY) {
    logger.error({ surveyId: survey.id, environmentId }, "ENCRYPTION_KEY is not set");
    return {
      response: responses.internalServerErrorResponse("An unexpected error occurred.", true),
    };
  }

  if (!responseInput.singleUseId) {
    return {
      response: responses.badRequestResponse(
        "Missing single use id",
        {
          surveyId: survey.id,
          environmentId,
        },
        true
      ),
    };
  }

  if (!responseInput.meta?.url) {
    return {
      response: responses.badRequestResponse(
        "Missing or invalid URL in response metadata",
        {
          surveyId: survey.id,
          environmentId,
        },
        true
      ),
    };
  }

  let url: URL;
  try {
    url = new URL(responseInput.meta.url);
  } catch (error) {
    return {
      response: responses.badRequestResponse(
        "Invalid URL in response metadata",
        {
          surveyId: survey.id,
          environmentId,
          error: error instanceof Error ? error.message : "Unknown error occurred",
        },
        true
      ),
    };
  }

  const suId = url.searchParams.get("suId");
  const suToken = url.searchParams.get("suToken");

  if (!suId) {
    return {
      response: responses.badRequestResponse(
        "Missing single use id",
        {
          surveyId: survey.id,
          environmentId,
        },
        true
      ),
    };
  }

  let canonicalSingleUseId: string | null = null;
  try {
    canonicalSingleUseId = validateSurveySingleUseLinkParams({
      surveyId: survey.id,
      suId,
      suToken,
      isEncrypted: survey.singleUse.isEncrypted,
      decrypt: (encryptedSingleUseId: string) => symmetricDecrypt(encryptedSingleUseId, ENCRYPTION_KEY),
    });
  } catch (error) {
    logger.error({ error, surveyId: survey.id, environmentId }, "Failed to validate single-use id");
  }

  if (!canonicalSingleUseId || canonicalSingleUseId !== responseInput.singleUseId) {
    return {
      response: responses.badRequestResponse(
        "Invalid single use id",
        {
          surveyId: survey.id,
          environmentId,
        },
        true
      ),
    };
  }

  return { singleUseId: canonicalSingleUseId };
};
