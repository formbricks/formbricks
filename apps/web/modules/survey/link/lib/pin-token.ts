import "server-only";
import jwt from "jsonwebtoken";
import { logger } from "@formbricks/logger";
import { BETTER_AUTH_SECRET, NEXTAUTH_SECRET } from "@/lib/constants";

const PIN_TOKEN_PURPOSE = "link_survey_pin";
const PIN_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour

// Mirror the auth session secret resolution (auth.ts / session-cookie.ts): prefer
// BETTER_AUTH_SECRET, fall back to NEXTAUTH_SECRET. A better-auth-only deployment sets only
// BETTER_AUTH_SECRET, so keying PIN tokens off NEXTAUTH_SECRET alone would throw and break PIN
// enforcement even though auth itself works.
const PIN_TOKEN_SECRET = BETTER_AUTH_SECRET ?? NEXTAUTH_SECRET;

export const createLinkSurveyPinToken = (surveyId: string): string => {
  if (!PIN_TOKEN_SECRET) {
    throw new Error("No auth secret set (BETTER_AUTH_SECRET or NEXTAUTH_SECRET)");
  }
  return jwt.sign({ surveyId, purpose: PIN_TOKEN_PURPOSE }, PIN_TOKEN_SECRET, {
    algorithm: "HS256",
    expiresIn: PIN_TOKEN_TTL_SECONDS,
  });
};

export const verifyLinkSurveyPinToken = (token: string | null | undefined, surveyId: string): boolean => {
  if (!token || !PIN_TOKEN_SECRET) {
    return false;
  }
  try {
    const payload = jwt.verify(token, PIN_TOKEN_SECRET, { algorithms: ["HS256"] }) as jwt.JwtPayload & {
      surveyId?: string;
      purpose?: string;
    };
    return payload.purpose === PIN_TOKEN_PURPOSE && payload.surveyId === surveyId;
  } catch (error) {
    logger.warn({ error, surveyId }, "Invalid link survey PIN token");
    return false;
  }
};
