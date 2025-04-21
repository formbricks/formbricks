import { authenticateRequest } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { handleDeleteFile } from "@/app/storage/[environmentId]/[accessType]/[fileName]/lib/delete-file";
import { hasUserEnvironmentAccess } from "@/lib/environment/auth";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { getServerSession } from "next-auth";
import { type NextRequest } from "next/server";
import { ZStorageRetrievalParams } from "@formbricks/types/storage";
import { getFile } from "./lib/get-file";

export const GET = async (
  request: NextRequest,
  props: { params: Promise<{ environmentId: string; accessType: string; fileName: string }> }
): Promise<Response> => {
  const params = await props.params;
  const paramValidation = ZStorageRetrievalParams.safeParse(params);

  if (!paramValidation.success) {
    return responses.badRequestResponse(
      "Fields are missing or incorrectly formatted",
      transformErrorToDetails(paramValidation.error),
      true
    );
  }

  const { environmentId, accessType, fileName: fileNameOG } = params;

  const fileName = decodeURIComponent(fileNameOG);

  if (accessType === "public") {
    return await getFile(environmentId, accessType, fileName);
  }

  // if the user is authenticated via the session

  const session = await getServerSession(authOptions);

  if (!session?.user) {
    // check for api key auth
    const res = await authenticateRequest(request);

    if (!res) {
      return responses.notAuthenticatedResponse();
    }

    return await getFile(environmentId, accessType, fileName);
  }

  const isUserAuthorized = await hasUserEnvironmentAccess(session.user.id, environmentId);

  if (!isUserAuthorized) {
    return responses.unauthorizedResponse();
  }

  return await getFile(environmentId, accessType, fileName);
};

export const DELETE = async (
  _: NextRequest,
  props: { params: Promise<{ fileName: string }> }
): Promise<Response> => {
  const params = await props.params;
  if (!params.fileName) {
    return responses.badRequestResponse("Fields are missing or incorrectly formatted", {
      fileName: "fileName is required",
    });
  }

  const [environmentId, accessType, file] = params.fileName.split("/");

  const paramValidation = ZStorageRetrievalParams.safeParse({ fileName: file, environmentId, accessType });

  if (!paramValidation.success) {
    return responses.badRequestResponse(
      "Fields are missing or incorrectly formatted",
      transformErrorToDetails(paramValidation.error),
      true
    );
  }
  // check if user is authenticated

  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return responses.notAuthenticatedResponse();
  }

  // check if the user has access to the environment

  const isUserAuthorized = await hasUserEnvironmentAccess(session.user.id, environmentId);

  if (!isUserAuthorized) {
    return responses.unauthorizedResponse();
  }

  return await handleDeleteFile(
    paramValidation.data.environmentId,
    paramValidation.data.accessType,
    paramValidation.data.fileName
  );
};
