import { logger } from "@formbricks/logger";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { ZDisplayCreateInputV2 } from "@/app/api/v2/client/[workspaceId]/displays/types/display";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { resolveClientApiIds } from "@/lib/utils/resolve-client-id";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { createDisplay } from "./lib/display";

interface Context {
  params: Promise<{
    workspaceId: string;
  }>;
}

export const OPTIONS = async (): Promise<Response> => {
  return responses.successResponse(
    {},
    true,
    // Cache CORS preflight responses for 1 hour (conservative approach)
    // Balances performance gains with flexibility for CORS policy changes
    "public, s-maxage=3600, max-age=3600"
  );
};

export const POST = async (request: Request, context: Context): Promise<Response> => {
  const params = await context.params;

  // Resolve: accepts either an environmentId (old SDK) or a workspaceId (new SDK)
  const resolved = await resolveClientApiIds(params.workspaceId);
  if (!resolved) {
    return responses.notFoundResponse("Workspace", params.workspaceId);
  }
  const { environmentId, workspaceId } = resolved;

  const jsonInput = await request.json();
  const inputValidation = ZDisplayCreateInputV2.safeParse({
    ...jsonInput,
    environmentId,
    workspaceId,
  });

  if (!inputValidation.success) {
    return responses.badRequestResponse(
      "Fields are missing or incorrectly formatted",
      transformErrorToDetails(inputValidation.error),
      true
    );
  }

  if (inputValidation.data.contactId) {
    const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);
    const isContactsEnabled = await getIsContactsEnabled(organizationId);
    if (!isContactsEnabled) {
      return responses.forbiddenResponse("User identification is only available for enterprise users.", true);
    }
  }

  try {
    const response = await createDisplay(inputValidation.data);

    return responses.successResponse(response, true);
  } catch (error) {
    if (error instanceof ResourceNotFoundError) {
      return responses.notFoundResponse("Survey", inputValidation.data.surveyId);
    } else {
      logger.error({ error, url: request.url }, "Error creating display");
      return responses.internalServerErrorResponse("Something went wrong. Please try again.");
    }
  }
};
