import "server-only";
import jwt from "jsonwebtoken";
import { logger } from "@formbricks/logger";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { TResponseData } from "@formbricks/types/responses";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import { TSurvey } from "@formbricks/types/surveys/types";
import { ENCRYPTION_KEY } from "@/lib/constants";
import { symmetricDecrypt, symmetricEncrypt } from "@/lib/crypto";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { getResponse } from "@/lib/response/service";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";

type TPrefillLinkError = {
  type: "internal_server_error" | "bad_request";
  message: string;
  details?: { field: string; issue: string }[];
};

// Default lifetime for a prefill link. Prefill tokens grant read access to a
// previous response's answers, so they are intentionally short-lived.
export const DEFAULT_PREFILL_LINK_EXPIRATION_DAYS = 7;

// Element types whose stored answer should never be prefilled from a previous
// response. File uploads hold storage keys (not re-usable answers) and would
// leak internal paths, so we strip them.
const NON_PREFILLABLE_ELEMENT_TYPES: TSurveyElementTypeEnum[] = [TSurveyElementTypeEnum.FileUpload];

/**
 * Creates a signed, encrypted link that prefills a link survey from a previous
 * response. The token carries the encrypted response and survey IDs, so the raw
 * `responseId` never appears in the URL and the token cannot be forged without
 * the server's `ENCRYPTION_KEY`. Because only holders of an API key can mint a
 * token (via the management endpoint), this preserves the invariant that reading
 * a response's data requires authorization.
 */
export const getPrefillSurveyLink = (
  responseId: string,
  surveyId: string,
  expirationDays: number = DEFAULT_PREFILL_LINK_EXPIRATION_DAYS
): Result<string, TPrefillLinkError> => {
  if (!ENCRYPTION_KEY) {
    return err({
      type: "internal_server_error",
      message: "Encryption key not found - cannot create prefill survey link",
    });
  }

  const encryptedResponseId = symmetricEncrypt(responseId, ENCRYPTION_KEY);
  const encryptedSurveyId = symmetricEncrypt(surveyId, ENCRYPTION_KEY);

  const payload = {
    responseId: encryptedResponseId,
    surveyId: encryptedSurveyId,
  };

  const tokenOptions: jwt.SignOptions = { algorithm: "HS256" };
  if (expirationDays > 0) {
    tokenOptions.expiresIn = `${expirationDays}d`;
  }

  const token = jwt.sign(payload, ENCRYPTION_KEY, tokenOptions);

  const surveyLink = new URL(`${getPublicDomain()}/s/${surveyId}`);
  surveyLink.searchParams.set("prefillToken", token);

  return ok(surveyLink.toString());
};

/**
 * Verifies and decrypts a prefill token. The signing algorithm is pinned to
 * HS256 to prevent algorithm-confusion attacks.
 */
export const verifyPrefillSurveyToken = (
  token: string
): Result<{ responseId: string; surveyId: string }, TPrefillLinkError> => {
  if (!ENCRYPTION_KEY) {
    return err({
      type: "internal_server_error",
      message: "Encryption key not found - cannot verify prefill token",
    });
  }

  try {
    const decoded = jwt.verify(token, ENCRYPTION_KEY, { algorithms: ["HS256"] }) as {
      responseId: string;
      surveyId: string;
    };

    if (!decoded || !decoded.responseId || !decoded.surveyId) {
      throw new Error("Invalid token format");
    }

    const responseId = symmetricDecrypt(decoded.responseId, ENCRYPTION_KEY);
    const surveyId = symmetricDecrypt(decoded.surveyId, ENCRYPTION_KEY);

    return ok({ responseId, surveyId });
  } catch (error) {
    logger.error(
      error instanceof Error ? error : new Error(String(error)),
      "Error verifying prefill survey token"
    );

    if (error instanceof jwt.TokenExpiredError) {
      return err({
        type: "bad_request",
        message: "Prefill link has expired",
        details: [{ field: "token", issue: "token_expired" }],
      });
    }

    return err({
      type: "bad_request",
      message: "Invalid prefill token",
      details: [{ field: "token", issue: "invalid_token" }],
    });
  }
};

/**
 * Builds prefill data from a stored response's `data`. Because the stored data is
 * already in the internal `TResponseData` shape, every supported question type
 * (including complex types like Address or Date that cannot be expressed as URL
 * query params) is populated as-is. Non-prefillable answers (e.g. file uploads)
 * are stripped.
 */
export const getPrefillDataFromResponse = (survey: TSurvey, data: TResponseData): TResponseData => {
  const elements = getElementsFromBlocks(survey.blocks);
  const nonPrefillableIds = new Set(
    elements.filter((element) => NON_PREFILLABLE_ELEMENT_TYPES.includes(element.type)).map((el) => el.id)
  );

  const prefillData: TResponseData = {};
  for (const [key, value] of Object.entries(data)) {
    if (nonPrefillableIds.has(key)) continue;
    prefillData[key] = value;
  }

  return prefillData;
};

/**
 * Resolves a prefill token into response data for a given survey. Best-effort:
 * returns `undefined` (rendering an empty survey) when the token is invalid or
 * expired, targets a different survey, or the response no longer exists. The
 * survey passed in is authoritative for the URL being visited, so the token's
 * survey and the response's survey must both match it.
 */
export const getPrefillResponseDataFromToken = async (
  token: string,
  survey: TSurvey
): Promise<TResponseData | undefined> => {
  const tokenResult = verifyPrefillSurveyToken(token);
  if (!tokenResult.ok) {
    return undefined;
  }

  const { responseId, surveyId } = tokenResult.data;

  // The token must have been minted for the survey being visited.
  if (surveyId !== survey.id) {
    logger.warn({ surveyId, expectedSurveyId: survey.id }, "Prefill token survey mismatch");
    return undefined;
  }

  const response = await getResponse(responseId);
  if (!response) {
    return undefined;
  }

  // Defense in depth: the response itself must belong to the visited survey.
  if (response.surveyId !== survey.id) {
    logger.warn(
      { responseSurveyId: response.surveyId, expectedSurveyId: survey.id },
      "Prefill response survey mismatch"
    );
    return undefined;
  }

  return getPrefillDataFromResponse(survey, response.data);
};
