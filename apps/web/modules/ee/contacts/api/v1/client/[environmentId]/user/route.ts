import { responses } from "@/app/lib/api/response";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { NextRequest, userAgent } from "next/server";
import { logger } from "@formbricks/logger";
import { TContactAttributes } from "@formbricks/types/contact-attribute";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { TJsPersonState } from "@formbricks/types/js";
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

export const POST = async (
  request: NextRequest,
  props: { params: Promise<{ environmentId: string }> }
): Promise<Response> => {
  const params = await props.params;

  try {
    const { environmentId } = params;

    // Simple validation (faster than Zod for high-frequency endpoint)
    if (!environmentId || typeof environmentId !== "string") {
      return responses.badRequestResponse("Environment ID is required", undefined, true);
    }

    const jsonInput = await request.json();

    // Basic input validation without Zod overhead
    if (
      !jsonInput ||
      typeof jsonInput !== "object" ||
      !jsonInput.userId ||
      typeof jsonInput.userId !== "string"
    ) {
      return responses.badRequestResponse("userId is required and must be a string", undefined, true);
    }

    // Simple email validation if present (avoid Zod)
    if (jsonInput.attributes?.email) {
      const email = jsonInput.attributes.email;
      if (typeof email !== "string" || !email.includes("@") || email.length < 3) {
        return responses.badRequestResponse("Invalid email format", undefined, true);
      }
    }

    const { userId, attributes } = jsonInput;

    const isContactsEnabled = await getIsContactsEnabled();
    if (!isContactsEnabled) {
      return responses.forbiddenResponse("User identification is only available for enterprise users.", true);
    }

    let attributeUpdatesToSend: TContactAttributes | null = null;
    if (attributes) {
      // remove userId and id from attributes
      const { userId: userIdAttr, id: idAttr, ...updatedAttributes } = attributes;
      attributeUpdatesToSend = updatedAttributes;
    }

    const { device } = userAgent(request);
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

    return responses.successResponse(responseJson, true);
  } catch (err) {
    if (err instanceof ResourceNotFoundError) {
      return responses.notFoundResponse(err.resourceType, err.resourceId);
    }

    logger.error({ error: err, url: request.url }, "Error in POST /api/v1/client/[environmentId]/user");
    return responses.internalServerErrorResponse(err.message ?? "Unable to fetch person state", true);
  }
};
