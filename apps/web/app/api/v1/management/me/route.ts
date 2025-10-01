import { headers } from "next/headers";
import { prisma } from "@formbricks/database";
import { getSessionUser } from "@/app/api/v1/management/me/lib/utils";
import { responses } from "@/app/lib/api/response";
import { hashSha256, verifySecret } from "@/lib/crypto";
import { parseApiKeyV2 } from "@/lib/crypto";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";

const ALLOWED_PERMISSIONS = ["manage", "read", "write"] as const;

const apiKeySelect = {
  id: true,
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

export const GET = async () => {
  const headersList = await headers();
  const apiKey = headersList.get("x-api-key");
  if (apiKey) {
    // Try v2 format first (fbk_{id}_{secret})
    const v2Parsed = parseApiKeyV2(apiKey);

    let apiKeyData;

    if (v2Parsed) {
      // New v2 format: lookup by id and verify with bcrypt
      apiKeyData = await prisma.apiKey.findUnique({
        where: { id: v2Parsed.id },
        select: apiKeySelect,
      });

      if (apiKeyData) {
        // Verify the secret against the bcrypt hash
        const isValid = await verifySecret(v2Parsed.secret, apiKeyData.hashedKey);
        if (!isValid) {
          apiKeyData = null;
        }
      }
    } else {
      // Legacy format: compute SHA-256 and lookup by hashedKey
      const hashedKey = hashSha256(apiKey);
      apiKeyData = await prisma.apiKey.findUnique({
        where: { hashedKey },
        select: apiKeySelect,
      });
    }

    if (!apiKeyData) {
      return responses.notAuthenticatedResponse();
    }

    // Update the last used timestamp
    await prisma.apiKey.update({
      where: {
        id: apiKeyData.id,
      },
      data: {
        lastUsedAt: new Date(),
      },
    });

    try {
      await applyRateLimit(rateLimitConfigs.api.v1, apiKeyData.id);
    } catch (error) {
      return responses.tooManyRequestsResponse(error.message);
    }

    if (
      apiKeyData.apiKeyEnvironments.length === 1 &&
      ALLOWED_PERMISSIONS.includes(apiKeyData.apiKeyEnvironments[0].permission)
    ) {
      return Response.json({
        id: apiKeyData.apiKeyEnvironments[0].environment.id,
        type: apiKeyData.apiKeyEnvironments[0].environment.type,
        createdAt: apiKeyData.apiKeyEnvironments[0].environment.createdAt,
        updatedAt: apiKeyData.apiKeyEnvironments[0].environment.updatedAt,
        appSetupCompleted: apiKeyData.apiKeyEnvironments[0].environment.appSetupCompleted,
        project: {
          id: apiKeyData.apiKeyEnvironments[0].environment.projectId,
          name: apiKeyData.apiKeyEnvironments[0].environment.project.name,
        },
      });
    } else {
      return responses.badRequestResponse("You can't use this method with this API key");
    }
  } else {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return responses.notAuthenticatedResponse();
    }

    try {
      await applyRateLimit(rateLimitConfigs.api.v1, sessionUser.id);
    } catch (error) {
      return responses.tooManyRequestsResponse(error.message);
    }

    const user = await prisma.user.findUnique({
      where: {
        id: sessionUser.id,
      },
    });

    return Response.json(user);
  }
};
