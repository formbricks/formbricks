import "server-only";
import jwt from "jsonwebtoken";
import { logger } from "@formbricks/logger";
import { AUTH_SECRET } from "@/lib/constants";

const PIN_TOKEN_PURPOSE = "link_survey_pin";
const PIN_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour

// The same resolved secret auth.ts hands Better Auth (see lib/constants.ts), so a better-auth-only
// deployment enforces PINs just like a legacy one.
//
// Resolved lazily inside the functions rather than at module scope: reading the constant at import
// time makes every unrelated test that mocks "@/lib/constants" (and transitively imports this module)
// fail Vitest's strict missing-export check. Deferring the access keeps import side-effect-free.
const resolvePinTokenSecret = (): string | undefined => AUTH_SECRET;

export const createLinkSurveyPinToken = (surveyId: string): string => {
  const secret = resolvePinTokenSecret();
  if (!secret) {
    throw new Error("No auth secret set (BETTER_AUTH_SECRET or NEXTAUTH_SECRET)");
  }
  return jwt.sign({ surveyId, purpose: PIN_TOKEN_PURPOSE }, secret, {
    algorithm: "HS256",
    expiresIn: PIN_TOKEN_TTL_SECONDS,
  });
};

export const verifyLinkSurveyPinToken = (token: string | null | undefined, surveyId: string): boolean => {
  const secret = resolvePinTokenSecret();
  if (!token || !secret) {
    return false;
  }
  try {
    const payload = jwt.verify(token, secret, { algorithms: ["HS256"] }) as jwt.JwtPayload & {
      surveyId?: string;
      purpose?: string;
    };
    return payload.purpose === PIN_TOKEN_PURPOSE && payload.surveyId === surveyId;
  } catch (error) {
    logger.warn({ error, surveyId }, "Invalid link survey PIN token");
    return false;
  }
};
