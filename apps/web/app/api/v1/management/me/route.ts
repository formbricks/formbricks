import { getSessionUser } from "@/app/api/v1/management/me/lib/utils";
import { responses } from "@/app/lib/api/response";
import { hashApiKey } from "@/modules/api/v2/management/lib/utils";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { headers } from "next/headers";
import { prisma } from "@formbricks/database";

const ALLOWED_PERMISSIONS = ["manage", "read", "write"] as const;

export const GET = async () => {
  const headersList = await headers();
  const apiKey = headersList.get("x-api-key");
  if (apiKey) {
    const hashedApiKey = hashApiKey(apiKey);

    const apiKeyData = await prisma.apiKey.findUnique({
      where: {
        hashedKey: hashedApiKey,
      },
      select: {
        apiKeyEnvironments: {
          select: {
            environment: {
              select: {
                id: true,
                type: true,
                createdAt: true,
                updatedAt: true,
                projectId: true,
                widgetSetupCompleted: true,
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
      },
    });

    if (!apiKeyData) {
      return responses.notAuthenticatedResponse();
    }

    try {
      await applyRateLimit(rateLimitConfigs.api.v1, hashedApiKey);
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
        widgetSetupCompleted: apiKeyData.apiKeyEnvironments[0].environment.widgetSetupCompleted,
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
