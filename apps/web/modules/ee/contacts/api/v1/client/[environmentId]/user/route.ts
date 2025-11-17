import { NextRequest, userAgent } from "next/server";
import { logger } from "@formbricks/logger";
import { TContactAttributes } from "@formbricks/types/contact-attribute";
import { ZEnvironmentId } from "@formbricks/types/environment";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { TJsPersonState } from "@formbricks/types/js";
import { responses } from "@/app/lib/api/response";
import { withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { updateUser } from "./lib/update-user";

export const OPTIONS = async (): Promise<Response> => {
  return responses.successResponse(
    {},
    true,
    // Cache CORS preflight responses for 1 hour (conservative approach)
    // Balances performance gains with flexibility for CORS policy changes
    "public, s-maxage=3600, max-age=3600"
  );
};

export const POST = withV1ApiWrapper({
  handler: async ({
    req,
    props,
  }: {
    req: NextRequest;
    props: { params: Promise<{ environmentId: string }> };
  }) => {
    const params = await props.params;

    try {
      // Basic type check for environmentId
      if (typeof params.environmentId !== "string") {
        return {
          response: responses.badRequestResponse("Environment ID is required", undefined, true),
        };
      }

      const environmentId = params.environmentId.trim();

      // Validate CUID v1 format using Zod (matches Prisma schema @default(cuid()))
      // This catches all invalid formats including:
      // - null/undefined passed as string "null" or "undefined"
      // - HTML-encoded placeholders like <environmentId> or %3C...%3E
      // - Empty or whitespace-only IDs
      // - Any other invalid CUID v1 format
      const cuidValidation = ZEnvironmentId.safeParse(environmentId);
      if (!cuidValidation.success) {
        logger.warn(
          {
            environmentId: params.environmentId,
            url: req.url,
            validationError: cuidValidation.error.errors[0]?.message,
          },
          "Invalid CUID v1 format detected"
        );
        return {
          response: responses.badRequestResponse("Invalid environment ID format", undefined, true),
        };
      }

      const jsonInput = await req.json();

      // Basic input validation without Zod overhead
      if (
        !jsonInput ||
        typeof jsonInput !== "object" ||
        !jsonInput.userId ||
        typeof jsonInput.userId !== "string"
      ) {
        return {
          response: responses.badRequestResponse("userId is required and must be a string", undefined, true),
        };
      }

      // Simple email validation if present (avoid Zod)
      if (jsonInput.attributes?.email) {
        const email = jsonInput.attributes.email;
        if (typeof email !== "string" || !email.includes("@") || email.length < 3) {
          return {
            response: responses.badRequestResponse("Invalid email format", undefined, true),
          };
        }
      }

      const { userId, attributes } = jsonInput;

      const isContactsEnabled = await getIsContactsEnabled();
      if (!isContactsEnabled) {
        return {
          response: responses.forbiddenResponse(
            "User identification is only available for enterprise users.",
            true
          ),
        };
      }

      let attributeUpdatesToSend: TContactAttributes | null = null;
      if (attributes) {
        // remove userId and id from attributes
        const { userId: userIdAttr, id: idAttr, ...updatedAttributes } = attributes;
        attributeUpdatesToSend = updatedAttributes;
      }

      const { device } = userAgent(req);
      const deviceType = device ? "phone" : "desktop";

      const { state: userState, messages } = await updateUser(
        environmentId,
        userId,
        deviceType,
        attributeUpdatesToSend ?? undefined
      );

      // Build response (simplified structure)
      const responseJson: { state: TJsPersonState; messages?: string[] } = {
        state: userState,
        ...(messages && messages.length > 0 && { messages }),
      };

      return {
        response: responses.successResponse(responseJson, true),
      };
    } catch (err) {
      if (err instanceof ResourceNotFoundError) {
        return {
          response: responses.notFoundResponse(err.resourceType, err.resourceId),
        };
      }

      logger.error({ error: err, url: req.url }, "Error in POST /api/v1/client/[environmentId]/user");
      return {
        response: responses.internalServerErrorResponse(err.message ?? "Unable to fetch person state", true),
      };
    }
  },
});
