import { headers } from "next/headers";
import { prisma } from "@formbricks/database";
import { getSessionUser } from "@/app/api/v1/management/me/lib/utils";
import { responses } from "@/app/lib/api/response";
import { CONTROL_HASH } from "@/lib/constants";
import { hashSha256, parseApiKeyV2, verifySecret } from "@/lib/crypto";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";

const ALLOWED_PERMISSIONS = ["manage", "read", "write"] as const;

const apiKeySelect = {
  id: true,
  organizationId: true,
  lastUsedAt: true,
  apiKeyEnvironments: {
    select: {
      environment: {
        select: {
          id: true,
          type: true,
          createdAt: true,
          updatedAt: true,
          projectId: true,
          appSetupCompleted: true,
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      permission: true,
    },
  },
  hashedKey: true,
};

type ApiKeyData = {
  id: string;
  hashedKey: string;
  organizationId: string;
  lastUsedAt: Date | null;
  apiKeyEnvironments: Array<{
    permission: string;
    environment: {
      id: string;
      type: string;
      createdAt: Date;
      updatedAt: Date;
      projectId: string;
      appSetupCompleted: boolean;
      project: {
        id: string;
        name: string;
      };
    };
  }>;
};

const validateApiKey = async (apiKey: string): Promise<ApiKeyData | null> => {
  const v2Parsed = parseApiKeyV2(apiKey);

  if (v2Parsed) {
    return validateV2ApiKey(v2Parsed);
  }

  return validateLegacyApiKey(apiKey);
};

const validateV2ApiKey = async (v2Parsed: { secret: string }): Promise<ApiKeyData | null> => {
  // Step 1: Fast SHA-256 lookup by indexed lookupHash
  const lookupHash = hashSha256(v2Parsed.secret);

  const apiKeyData = await prisma.apiKey.findUnique({
    where: { lookupHash },
    select: apiKeySelect,
  });

  // Step 2: Security verification with bcrypt
  // Always perform bcrypt verification to prevent timing attacks
  // Use a control hash when API key doesn't exist to maintain constant timing
  const hashToVerify = apiKeyData?.hashedKey || CONTROL_HASH;
  const isValid = await verifySecret(v2Parsed.secret, hashToVerify);

  if (!apiKeyData || !isValid) return null;

  return apiKeyData;
};

const validateLegacyApiKey = async (apiKey: string): Promise<ApiKeyData | null> => {
  const hashedKey = hashSha256(apiKey);
  const result = await prisma.apiKey.findFirst({
    where: { hashedKey },
    select: apiKeySelect,
  });
  return result;
};

const checkRateLimit = async (userId: string) => {
  try {
    await applyRateLimit(rateLimitConfigs.api.v1, userId);
  } catch (error) {
    return responses.tooManyRequestsResponse(error.message);
  }
  return null;
};

const updateApiKeyUsage = async (apiKeyId: string) => {
  await prisma.apiKey.update({
    where: { id: apiKeyId },
    data: { lastUsedAt: new Date() },
  });
};

const buildEnvironmentResponse = (apiKeyData: ApiKeyData) => {
  const env = apiKeyData.apiKeyEnvironments[0].environment;
  return Response.json({
    id: env.id,
    type: env.type,
    createdAt: env.createdAt,
    updatedAt: env.updatedAt,
    appSetupCompleted: env.appSetupCompleted,
    project: {
      id: env.projectId,
      name: env.project.name,
    },
  });
};

const isValidApiKeyEnvironment = (apiKeyData: ApiKeyData): boolean => {
  return (
    apiKeyData.apiKeyEnvironments.length === 1 &&
    ALLOWED_PERMISSIONS.includes(
      apiKeyData.apiKeyEnvironments[0].permission as (typeof ALLOWED_PERMISSIONS)[number]
    )
  );
};

const handleApiKeyAuthentication = async (apiKey: string) => {
  const apiKeyData = await validateApiKey(apiKey);

  if (!apiKeyData) {
    return responses.notAuthenticatedResponse();
  }

  if (!apiKeyData.lastUsedAt || apiKeyData.lastUsedAt <= new Date(Date.now() - 1000 * 30)) {
    // Fire-and-forget: update lastUsedAt in the background without blocking the response
    updateApiKeyUsage(apiKeyData.id).catch((error) => {
      console.error("Failed to update API key usage:", error);
    });
  }

  const rateLimitError = await checkRateLimit(apiKeyData.id);
  if (rateLimitError) return rateLimitError;

  if (!isValidApiKeyEnvironment(apiKeyData)) {
    return responses.badRequestResponse("You can't use this method with this API key");
  }

  return buildEnvironmentResponse(apiKeyData);
};

const handleSessionAuthentication = async () => {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    return responses.notAuthenticatedResponse();
  }

  const rateLimitError = await checkRateLimit(sessionUser.id);
  if (rateLimitError) return rateLimitError;

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
  });

  return Response.json(user);
};

export const GET = async () => {
  const headersList = await headers();
  const apiKey = headersList.get("x-api-key");

  if (apiKey) {
    return handleApiKeyAuthentication(apiKey);
  }

  return handleSessionAuthentication();
};
