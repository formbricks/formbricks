import { responses } from "@/app/lib/api/response";
import { getBiggerUploadFileSizePermission } from "@/modules/ee/license-check/lib/utils";
import { NextRequest } from "next/server";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getSurvey } from "@formbricks/lib/survey/service";
import { uploadPrivateFile } from "./lib/uploadPrivateFile";

interface Context {
  params: Promise<{
    environmentId: string;
  }>;
}

export const OPTIONS = async (): Promise<Response> => {
  return responses.successResponse({}, true);
};

// api endpoint for uploading private files
// uploaded files will be private, only the user who has access to the environment can access the file
// uploading private files requires no authentication
// use this to let users upload files to a survey for example
// this api endpoint will return a signed url for uploading the file to s3 and another url for uploading file to the local storage

export const POST = async (req: NextRequest, context: Context): Promise<Response> => {
  const params = await context.params;
  const environmentId = params.environmentId;

  const { fileName, fileType, surveyId } = await req.json();

  if (!surveyId) {
    return responses.badRequestResponse("surveyId ID is required");
  }

  if (!fileName) {
    return responses.badRequestResponse("fileName is required");
  }

  if (!fileType) {
    return responses.badRequestResponse("contentType is required");
  }

  const [survey, organization] = await Promise.all([
    getSurvey(surveyId),
    getOrganizationByEnvironmentId(environmentId),
  ]);

  if (!survey) {
    return responses.notFoundResponse("Survey", surveyId);
  }

  if (!organization) {
    return responses.notFoundResponse("OrganizationByEnvironmentId", environmentId);
  }

  const isBiggerFileUploadAllowed = await getBiggerUploadFileSizePermission(organization.billing.plan);

  return await uploadPrivateFile(fileName, environmentId, fileType, isBiggerFileUploadAllowed);
};
