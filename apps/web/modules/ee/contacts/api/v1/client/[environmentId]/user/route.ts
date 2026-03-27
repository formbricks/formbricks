import { userAgent } from "next/server";
import { logger } from "@formbricks/logger";
import { TContactAttributesInput } from "@formbricks/types/contact-attribute";
import { ZEnvironmentId } from "@formbricks/types/environment";
import { ResourceNotFoundError, ValidationError } from "@formbricks/types/errors";
import { TJsPersonState } from "@formbricks/types/js";
import { responses } from "@/app/lib/api/response";
import { THandlerParams, withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { getOrganizationIdFromEnvironmentId } from "@/lib/utils/helper";
import { resolveClientApiIds } from "@/lib/utils/resolve-client-id";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { updateUser } from "./lib/update-user";

const handleError = (err: unknown, url: string): { response: Response } => {
  if (err instanceof ResourceNotFoundError) {
    return { response: responses.notFoundResponse(err.resourceType, err.resourceId) };
  }

  if (err instanceof ValidationError) {
    return { response: responses.badRequestResponse(err.message, undefined, true) };
  }

  logger.error({ error: err, url }, "Error in POST /api/v1/client/[environmentId]/user");
  return { response: responses.internalServerErrorResponse("Unable to fetch user state", true) };
};

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
  handler: async ({ req, props }: THandlerParams<{ params: Promise<{ environmentId: string }> }>) => {
    const params = await props.params;

    try {
      // Basic type check for environmentId
      if (typeof params.environmentId !== "string") {
        return {
          response: responses.badRequestResponse("Environment ID is required", undefined, true),
        };
      }

      const idParam = params.environmentId.trim();

      // Validate CUID format
      const cuidValidation = ZEnvironmentId.safeParse(idParam);
      if (!cuidValidation.success) {
        logger.warn(
          {
            environmentId: params.environmentId,
            url: req.url,
            validationError: cuidValidation.error.issues[0]?.message,
          },
          "Invalid CUID format detected"
        );
        return {
          response: responses.badRequestResponse("Invalid environment ID format", undefined, true),
        };
      }

      // Resolve: accepts either an environmentId (old SDK) or a projectId (new SDK)
      const resolved = await resolveClientApiIds(idParam);
      if (!resolved) {
        return {
          response: responses.notFoundResponse("Environment", idParam),
        };
      }
      const { environmentId } = resolved;

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

      const organizationId = await getOrganizationIdFromEnvironmentId(environmentId);
      const isContactsEnabled = await getIsContactsEnabled(organizationId);
      if (!isContactsEnabled) {
        return {
          response: responses.forbiddenResponse(
            "User identification is only available for enterprise users.",
            true
          ),
        };
      }

      let attributeUpdatesToSend: TContactAttributesInput | null = null;
      if (attributes) {
        // remove userId and id from attributes
        const { userId: userIdAttr, id: idAttr, ...updatedAttributes } = attributes;
        attributeUpdatesToSend = updatedAttributes as TContactAttributesInput;
      }

      const { device } = userAgent(req);
      const deviceType = device ? "phone" : "desktop";

      const {
        state: userState,
        messages,
        errors,
      } = await updateUser(environmentId, userId, deviceType, attributeUpdatesToSend ?? undefined);

      // Build response (simplified structure)
      const responseJson: { state: TJsPersonState; messages?: string[]; errors?: string[] } = {
        state: userState,
        ...(messages && messages.length > 0 && { messages }),
        ...(errors && errors.length > 0 && { errors }),
      };

      return {
        response: responses.successResponse(responseJson, true),
      };
    } catch (err) {
      return handleError(err, req.url);
    }
  },
});
