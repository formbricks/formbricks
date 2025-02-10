import { responses } from "@/modules/api/lib/response";
import { authenticatedApiClient, checkAuthorization } from "@/modules/api/management/auth";
import { getEnvironmentIdFromResponseId } from "@/modules/api/management/lib/helper";
import {
  deleteResponse,
  getResponse,
  updateResponse,
} from "@/modules/api/management/responses/[responseId]/lib/response";
import { z } from "zod";
import { ZResponse } from "@formbricks/database/zod/responses";
import { validateInputs } from "@formbricks/lib/utils/validate";

export const GET = async (request: Request, props: { params: Promise<{ responseId: string }> }) =>
  authenticatedApiClient({
    request,
    handler: async ({ authentication }) => {
      const params = await props.params;

      const [parsedResponseId] = validateInputs([params.responseId, z.string().cuid2()]);

      checkAuthorization({
        authentication,
        environmentId: await getEnvironmentIdFromResponseId(parsedResponseId),
      });

      const response = await getResponse(parsedResponseId);
      if (!response) {
        return responses.notFoundResponse("Response", parsedResponseId);
      }
      return responses.successResponse(response);
    },
  });

export const DELETE = (request: Request, props: { params: Promise<{ responseId: string }> }) =>
  authenticatedApiClient({
    request,
    handler: async ({ authentication }) => {
      const params = await props.params;

      const [parsedResponseId] = validateInputs([params.responseId, z.string().cuid2()]);

      checkAuthorization({
        authentication,
        environmentId: await getEnvironmentIdFromResponseId(parsedResponseId),
      });

      const response = await deleteResponse(parsedResponseId);

      return responses.successResponse(response);
    },
  });

export const PUT = (request: Request, props: { params: Promise<{ responseId: string }> }) =>
  authenticatedApiClient({
    request,
    schema: ZResponse,
    handler: async ({ authentication, parsedInput }) => {
      const params = await props.params;

      const [parsedResponseId] = validateInputs([params.responseId, z.string().cuid2()]);

      checkAuthorization({
        authentication,
        environmentId: await getEnvironmentIdFromResponseId(parsedResponseId),
      });

      if (!parsedInput) {
        return responses.badRequestResponse("Malformed JSON input, please check your request body");
      }

      const response = await updateResponse(parsedResponseId, parsedInput);

      return responses.successResponse(response);
    },
  });
