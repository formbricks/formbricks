import { responses } from "@/app/lib/api/response";
import { authenticatedAPIClient, checkAuthorization } from "@/modules/api/management/auth";
import { getEnvironmentIdFromResponseId } from "@/modules/api/management/lib/helper";
import {
  deleteResponse,
  getResponse,
  updateResponse,
} from "@/modules/api/management/responses/[responseId]/lib/response";
import { z } from "zod";
import { ZResponse } from "@formbricks/database/zod/responses";
import { validateInputs } from "@formbricks/lib/utils/validate";

// export const GET = async (
//   request: Request,
//   props: { params: Promise<{ responseId: string }> }
// ): Promise<Response> => {
//   const params = await props.params;
//   try {
//     const authentication = await authenticateRequest(request);
//     if (!authentication) return responses.notAuthenticatedResponse();
//     const response = await fetchAndValidateResponse(authentication, params.responseId);
//     if (response) {
//       return responses.successResponse(response);
//     }
//     return responses.notFoundResponse("Response", params.responseId);
//   } catch (error) {
//     return handleErrorResponse(error);
//   }
// };

export const getHandler = async (request: Request, props: { params: Promise<{ responseId: string }> }) =>
  authenticatedAPIClient({
    request,
    handler: async ({ authentication }) => {
      try {
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
      } catch (err) {
        // return handleErrorResponse(err);
      }
    },
  });

// export const defaultExporter = () => { }
// export const GET = defaultExporter(getHandler)

export const DELETE = (request: Request, props: { params: Promise<{ responseId: string }> }) =>
  authenticatedAPIClient({
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
  authenticatedAPIClient({
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

// export const PUT = async (
//   request: Request,
//   props: { params: Promise<{ responseId: string }> }
// ): Promise<Response> => {
//   const params = await props.params;
//   try {
//     const authentication = await authenticateRequest(request);
//     if (!authentication) return responses.notAuthenticatedResponse();
//     await fetchAndValidateResponse(authentication, params.responseId);
//     let responseUpdate;
//     try {
//       responseUpdate = await request.json();
//     } catch (error) {
//       console.error(`Error parsing JSON: ${error}`);
//       return responses.badRequestResponse("Malformed JSON input, please check your request body");
//     }

//     const inputValidation = ZResponseUpdateInput.safeParse(responseUpdate);
//     if (!inputValidation.success) {
//       return responses.badRequestResponse(
//         "Fields are missing or incorrectly formatted",
//         transformErrorToDetails(inputValidation.error)
//       );
//     }
//     return responses.successResponse(await updateResponse(params.responseId, inputValidation.data));
//   } catch (error) {
//     return handleErrorResponse(error);
//   }
// };
