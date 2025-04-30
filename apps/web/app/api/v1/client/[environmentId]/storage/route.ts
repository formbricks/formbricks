import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { validateFile } from "@/lib/fileValidation";
import { getOrganizationByEnvironmentId } from "@/lib/organization/service";
import { getSurvey } from "@/lib/survey/service";
import { getBiggerUploadFileSizePermission } from "@/modules/ee/license-check/lib/utils";
import { NextRequest } from "next/server";
import { ZUploadFileRequest } from "@formbricks/types/storage";
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

  const jsonInput = await req.json();
  const inputValidation = ZUploadFileRequest.safeParse({
    ...jsonInput,
    environmentId,
  });

  if (!inputValidation.success) {
    return responses.badRequestResponse(
      "Invalid request",
      transformErrorToDetails(inputValidation.error),
      true
    );
  }

  const { fileName, fileType, surveyId } = inputValidation.data;

  // Perform server-side file validation
  const fileValidation = validateFile(fileName, fileType);
  if (!fileValidation.valid) {
    return responses.badRequestResponse(fileValidation.error ?? "Invalid file", { fileName, fileType }, true);
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
