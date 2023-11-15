import { authOptions } from "@formbricks/lib/authOptions";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { ZStorageRetrievalParams } from "@formbricks/types/storage";
import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import getFile from "./lib/getFile";
import { handleDeleteFile } from "@/app/storage/[environmentId]/[accessType]/[fileName]/lib/deleteFile";

export async function GET(
  _: NextRequest,
  { params }: { params: { environmentId: string; accessType: string; fileName: string } }
) {
  const paramValidation = ZStorageRetrievalParams.safeParse(params);

  if (!paramValidation.success) {
    return responses.badRequestResponse(
      "Fields are missing or incorrectly formatted",
      transformErrorToDetails(paramValidation.error),
      true
    );
  }

  const { environmentId, accessType, fileName } = params;

  if (accessType === "public") {
    return await getFile(environmentId, accessType, fileName);
  }

  // auth and download private file

  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return responses.notAuthenticatedResponse();
  }

  const isUserAuthorized = await hasUserEnvironmentAccess(session.user.id, environmentId);

  if (!isUserAuthorized) {
    return responses.unauthorizedResponse();
  }

  return await getFile(environmentId, accessType, fileName);
}

export async function DELETE(_: NextRequest, { params }: { params: { fileName: string } }) {
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

  if (!session || !session.user) {
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
}
