import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ENCRYPTION_KEY, NEXTAUTH_SECRET } from "@/lib/constants";
import { symmetricDecrypt, symmetricEncrypt } from "@/lib/crypto";
import { TGatewayAuthService, getGatewayAuthServiceTokenPurpose } from "@/modules/gateway-auth/lib/service";

const FEEDBACK_RECORDS_GATEWAY_TOKEN_TTL_SECONDS = 60 * 10;

// Helper function to decrypt with fallback to plain text
const decryptWithFallback = (encryptedText: string, key: string): string => {
  try {
    return symmetricDecrypt(encryptedText, key);
  } catch {
    return encryptedText; // Return as-is if decryption fails (legacy format)
  }
};

/**
 * Every token minted here is signed with the same `NEXTAUTH_SECRET`, so the signature alone proves
 * nothing about *which* flow a token was issued for. Tokens that grant something must therefore carry
 * an explicit `purpose` claim and the verifier must require it, otherwise a token handed out by one
 * flow is replayable against another (e.g. an email- or invite-token accepted as proof of email
 * verification for a link survey).
 */
export const LINK_SURVEY_EMAIL_VERIFICATION_PURPOSE = "link_survey_email_verification";
export const EMAIL_DISPLAY_TOKEN_PURPOSE = "email_display";

const LINK_SURVEY_TOKEN_TTL = "7d";
const EMAIL_DISPLAY_TOKEN_TTL = "1d";

export const VERIFICATION_TOKEN_PURPOSES = ["email_verification", "sso_recovery"] as const;

export type TVerificationTokenPurpose = (typeof VERIFICATION_TOKEN_PURPOSES)[number];

export type TVerifyTokenPayload = JwtPayload & {
  id: string;
  email: string;
  purpose: TVerificationTokenPurpose;
};

type TVerificationTokenOptions = SignOptions & {
  purpose?: TVerificationTokenPurpose;
};

type TSsoRelinkIntentPayload = {
  callbackUrl: string;
  email: string;
  provider: string;
  providerAccountId: string;
  userId: string;
};

const DEFAULT_VERIFICATION_TOKEN_PURPOSE: TVerificationTokenPurpose = "email_verification";

const getVerificationTokenPurpose = (purpose: unknown): TVerificationTokenPurpose => {
  if (purpose && VERIFICATION_TOKEN_PURPOSES.includes(purpose as TVerificationTokenPurpose)) {
    return purpose as TVerificationTokenPurpose;
  }

  return DEFAULT_VERIFICATION_TOKEN_PURPOSE;
};

export const createToken = (userId: string, options: TVerificationTokenOptions = {}): string => {
  if (!NEXTAUTH_SECRET) {
    throw new Error("NEXTAUTH_SECRET is not set");
  }

  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not set");
  }

  const encryptedUserId = symmetricEncrypt(userId, ENCRYPTION_KEY);
  const { purpose = DEFAULT_VERIFICATION_TOKEN_PURPOSE, ...jwtOptions } = options;

  return jwt.sign({ id: encryptedUserId, purpose }, NEXTAUTH_SECRET, jwtOptions);
};

export const createGatewayServiceToken = (
  userId: string,
  service: TGatewayAuthService
): {
  token: string;
  expiresAt: string;
} => {
  if (!NEXTAUTH_SECRET) {
    throw new Error("NEXTAUTH_SECRET is not set");
  }

  const token = jwt.sign({ purpose: getGatewayAuthServiceTokenPurpose(service) }, NEXTAUTH_SECRET, {
    algorithm: "HS256",
    expiresIn: FEEDBACK_RECORDS_GATEWAY_TOKEN_TTL_SECONDS,
    subject: userId,
  });

  const decodedToken = jwt.decode(token);
  if (!decodedToken || typeof decodedToken !== "object" || typeof decodedToken.exp !== "number") {
    throw new Error("Failed to create feedback records gateway token");
  }

  return {
    token,
    expiresAt: new Date(decodedToken.exp * 1000).toISOString(),
  };
};

export const createFeedbackRecordsGatewayToken = (
  userId: string
): {
  token: string;
  expiresAt: string;
} => {
  return createGatewayServiceToken(userId, "feedbackRecords");
};

export const createTokenForLinkSurvey = (surveyId: string, userEmail: string): string => {
  if (!NEXTAUTH_SECRET) {
    throw new Error("NEXTAUTH_SECRET is not set");
  }

  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not set");
  }

  const encryptedEmail = symmetricEncrypt(userEmail, ENCRYPTION_KEY);
  return jwt.sign(
    { email: encryptedEmail, surveyId, purpose: LINK_SURVEY_EMAIL_VERIFICATION_PURPOSE },
    NEXTAUTH_SECRET,
    { expiresIn: LINK_SURVEY_TOKEN_TTL }
  );
};

export const verifyEmailChangeToken = async (token: string): Promise<{ id: string; email: string }> => {
  if (!NEXTAUTH_SECRET) {
    throw new Error("NEXTAUTH_SECRET is not set");
  }

  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not set");
  }

  const payload = jwt.verify(token, NEXTAUTH_SECRET, { algorithms: ["HS256"] }) as {
    id: string;
    email: string;
  };

  if (!payload?.id || !payload?.email) {
    throw new Error("Token is invalid or missing required fields");
  }

  // Decrypt both fields with fallback
  const decryptedId = decryptWithFallback(payload.id, ENCRYPTION_KEY);
  const decryptedEmail = decryptWithFallback(payload.email, ENCRYPTION_KEY);

  return {
    id: decryptedId,
    email: decryptedEmail,
  };
};

export const verifyGatewayServiceToken = (
  token: string,
  service: TGatewayAuthService
): {
  userId: string;
} => {
  if (!NEXTAUTH_SECRET) {
    throw new Error("NEXTAUTH_SECRET is not set");
  }

  const payload = jwt.verify(token, NEXTAUTH_SECRET, { algorithms: ["HS256"] }) as JwtPayload & {
    purpose?: string;
    sub?: string;
  };

  if (payload.purpose !== getGatewayAuthServiceTokenPurpose(service) || !payload.sub) {
    throw new Error("Invalid feedback records gateway token");
  }

  return {
    userId: payload.sub,
  };
};

export const verifyFeedbackRecordsGatewayToken = (
  token: string
): {
  userId: string;
} => {
  return verifyGatewayServiceToken(token, "feedbackRecords");
};

export const createEmailChangeToken = (userId: string, email: string): string => {
  if (!NEXTAUTH_SECRET) {
    throw new Error("NEXTAUTH_SECRET is not set");
  }

  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not set");
  }

  const encryptedUserId = symmetricEncrypt(userId, ENCRYPTION_KEY);
  const encryptedEmail = symmetricEncrypt(email, ENCRYPTION_KEY);

  const payload = {
    id: encryptedUserId,
    email: encryptedEmail,
  };

  return jwt.sign(payload, NEXTAUTH_SECRET, {
    expiresIn: "1d",
  });
};

export const createEmailToken = (email: string): string => {
  if (!NEXTAUTH_SECRET) {
    throw new Error("NEXTAUTH_SECRET is not set");
  }

  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not set");
  }

  const encryptedEmail = symmetricEncrypt(email, ENCRYPTION_KEY);
  // Handed out by an unauthenticated action purely so the "check your inbox" screen can echo the
  // address back. It must therefore be inert everywhere else: scope it with a purpose and a TTL.
  return jwt.sign({ email: encryptedEmail, purpose: EMAIL_DISPLAY_TOKEN_PURPOSE }, NEXTAUTH_SECRET, {
    expiresIn: EMAIL_DISPLAY_TOKEN_TTL,
  });
};

export const getEmailFromEmailToken = (token: string): string => {
  if (!NEXTAUTH_SECRET) {
    throw new Error("NEXTAUTH_SECRET is not set");
  }

  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not set");
  }

  const payload = jwt.verify(token, NEXTAUTH_SECRET, { algorithms: ["HS256"] }) as JwtPayload & {
    email: string;
    purpose?: string;
  };

  // Tokens minted before the purpose claim existed have none; anything else was issued for a
  // different flow and must not resolve to an email here.
  if (payload.purpose !== undefined && payload.purpose !== EMAIL_DISPLAY_TOKEN_PURPOSE) {
    throw new Error("Invalid token");
  }

  return decryptWithFallback(payload.email, ENCRYPTION_KEY);
};

export const createInviteToken = (inviteId: string, email: string, options = {}): string => {
  if (!NEXTAUTH_SECRET) {
    throw new Error("NEXTAUTH_SECRET is not set");
  }

  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not set");
  }

  const encryptedInviteId = symmetricEncrypt(inviteId, ENCRYPTION_KEY);
  const encryptedEmail = symmetricEncrypt(email, ENCRYPTION_KEY);
  return jwt.sign({ inviteId: encryptedInviteId, email: encryptedEmail }, NEXTAUTH_SECRET, options);
};

export const verifyTokenForLinkSurvey = (token: string, surveyId: string): string | null => {
  if (!NEXTAUTH_SECRET) {
    return null;
  }

  try {
    let payload: JwtPayload & { email: string; surveyId?: string; purpose?: string };
    // Legacy tokens carry no `surveyId` claim; they are bound to one survey by their signing key
    // (`NEXTAUTH_SECRET + surveyId`) instead, so that path needs no claim check.
    let isBoundBySigningKey = false;

    // Try primary method first (consistent secret)
    try {
      payload = jwt.verify(token, NEXTAUTH_SECRET, { algorithms: ["HS256"] }) as JwtPayload & {
        email: string;
        surveyId: string;
      };
    } catch (primaryError) {
      logger.error(primaryError, "Token verification failed with primary method");

      // Fallback to legacy method (surveyId-based secret)
      try {
        payload = jwt.verify(token, NEXTAUTH_SECRET + surveyId, { algorithms: ["HS256"] }) as JwtPayload & {
          email: string;
        };
        isBoundBySigningKey = true;
      } catch (legacyError) {
        logger.error(legacyError, "Token verification failed with legacy method");
        throw new Error("Invalid token");
      }
    }

    // A token verified with the plain secret MUST name this survey. Accepting a missing `surveyId`
    // here let any NEXTAUTH_SECRET-signed token that happens to carry an `email` claim — e.g. the one
    // `createEmailToken` hands out for an arbitrary address — pass as a verified email for any survey.
    if (!isBoundBySigningKey && payload.surveyId !== surveyId) {
      return null;
    }

    // Reject tokens explicitly minted for a different flow. Tokens issued before the purpose claim
    // existed have none; they are already survey-bound by the check above.
    if (payload.purpose !== undefined && payload.purpose !== LINK_SURVEY_EMAIL_VERIFICATION_PURPOSE) {
      return null;
    }

    const { email } = payload;
    if (!email) {
      return null;
    }

    // Decrypt email with fallback to plain text
    if (!ENCRYPTION_KEY) {
      return email; // Return as-is if encryption key not set
    }

    return decryptWithFallback(email, ENCRYPTION_KEY);
  } catch (error) {
    logger.error(error, "Survey link token verification failed");
    return null;
  }
};

// Helper function to get user email for legacy verification
const getUserEmailForLegacyVerification = async (
  token: string,
  userId?: string
): Promise<{ userId: string; userEmail: string }> => {
  if (!userId) {
    const decoded = jwt.decode(token);

    // Validate decoded token structure before using it
    if (
      !decoded ||
      typeof decoded !== "object" ||
      !decoded.id ||
      typeof decoded.id !== "string" ||
      decoded.id.trim() === ""
    ) {
      logger.error("Invalid token: missing or invalid user ID");
      throw new Error("Invalid token");
    }

    userId = decoded.id;
  }

  const decryptedId = decryptWithFallback(userId, ENCRYPTION_KEY);

  // Validate decrypted ID before database query
  if (!decryptedId || typeof decryptedId !== "string" || decryptedId.trim() === "") {
    logger.error("Invalid token: missing or invalid user ID");
    throw new Error("Invalid token");
  }

  const foundUser = await prisma.user.findUnique({
    where: { id: decryptedId },
  });

  if (!foundUser) {
    const errorMessage = "User not found";
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }

  return { userId: decryptedId, userEmail: foundUser.email };
};

const DEFAULT_SSO_RELINK_INTENT_OPTIONS: SignOptions = {
  expiresIn: "15m",
};

export const createSsoRelinkIntent = (
  payload: TSsoRelinkIntentPayload,
  options: SignOptions = DEFAULT_SSO_RELINK_INTENT_OPTIONS
): string => {
  if (!NEXTAUTH_SECRET) {
    throw new Error("NEXTAUTH_SECRET is not set");
  }

  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not set");
  }

  return jwt.sign(
    {
      userId: symmetricEncrypt(payload.userId, ENCRYPTION_KEY),
      email: symmetricEncrypt(payload.email, ENCRYPTION_KEY),
      provider: payload.provider,
      providerAccountId: symmetricEncrypt(payload.providerAccountId, ENCRYPTION_KEY),
      callbackUrl: symmetricEncrypt(payload.callbackUrl, ENCRYPTION_KEY),
    },
    NEXTAUTH_SECRET,
    options
  );
};

export const verifySsoRelinkIntent = (token: string): TSsoRelinkIntentPayload => {
  if (!NEXTAUTH_SECRET) {
    throw new Error("NEXTAUTH_SECRET is not set");
  }

  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not set");
  }

  const payload = jwt.verify(token, NEXTAUTH_SECRET, { algorithms: ["HS256"] }) as JwtPayload & {
    userId: string;
    email: string;
    provider: string;
    providerAccountId: string;
    callbackUrl: string;
  };

  if (
    !payload?.userId ||
    !payload?.email ||
    !payload?.provider ||
    !payload?.providerAccountId ||
    !payload?.callbackUrl
  ) {
    throw new Error("Token is invalid or missing required fields");
  }

  return {
    userId: decryptWithFallback(payload.userId, ENCRYPTION_KEY),
    email: decryptWithFallback(payload.email, ENCRYPTION_KEY),
    provider: payload.provider,
    providerAccountId: decryptWithFallback(payload.providerAccountId, ENCRYPTION_KEY),
    callbackUrl: decryptWithFallback(payload.callbackUrl, ENCRYPTION_KEY),
  };
};

export const verifyToken = async (token: string): Promise<TVerifyTokenPayload> => {
  if (!NEXTAUTH_SECRET) {
    throw new Error("NEXTAUTH_SECRET is not set");
  }

  let payload: JwtPayload & { id: string };
  let userData: { userId: string; userEmail: string } | null = null;

  // Try new method first, with smart fallback to legacy
  try {
    payload = jwt.verify(token, NEXTAUTH_SECRET, { algorithms: ["HS256"] }) as JwtPayload & {
      id: string;
    };
  } catch (newMethodError) {
    logger.error(newMethodError, "Token verification failed with new method");

    // Get user email for legacy verification
    userData = await getUserEmailForLegacyVerification(token);

    // Try legacy verification with email-based secret
    try {
      payload = jwt.verify(token, NEXTAUTH_SECRET + userData.userEmail, {
        algorithms: ["HS256"],
      }) as JwtPayload & {
        id: string;
      };
    } catch (legacyMethodError) {
      logger.error(legacyMethodError, "Token verification failed with legacy method");
      throw new Error("Invalid token");
    }
  }

  if (!payload?.id) {
    throw new Error("Invalid token");
  }

  // Get user email if we don't have it yet
  userData ??= await getUserEmailForLegacyVerification(token, payload.id);

  return {
    id: userData.userId,
    email: userData.userEmail,
    purpose: getVerificationTokenPurpose(payload.purpose),
  };
};

export const verifyInviteToken = (token: string): { inviteId: string; email: string } => {
  if (!NEXTAUTH_SECRET) {
    throw new Error("NEXTAUTH_SECRET is not set");
  }

  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not set");
  }

  try {
    const payload = jwt.verify(token, NEXTAUTH_SECRET, { algorithms: ["HS256"] }) as JwtPayload & {
      inviteId: string;
      email: string;
    };

    const { inviteId: encryptedInviteId, email: encryptedEmail } = payload;

    if (!encryptedInviteId || !encryptedEmail) {
      throw new Error("Invalid token");
    }

    // Decrypt both fields with fallback to original values
    const decryptedInviteId = decryptWithFallback(encryptedInviteId, ENCRYPTION_KEY);
    const decryptedEmail = decryptWithFallback(encryptedEmail, ENCRYPTION_KEY);

    return {
      inviteId: decryptedInviteId,
      email: decryptedEmail,
    };
  } catch (error) {
    logger.error(error, "Error verifying invite token");
    throw new Error("Invalid or expired invite token");
  }
};
