import { responses } from "@/app/lib/api/response";
import { getSurvey } from "@formbricks/lib/survey/service";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";
import { NextRequest, NextResponse } from "next/server";
import uploadPrivateFile from "./lib/uploadPrivateFile";

// api endpoint for uploading private files
// uploaded files will be private, only the user who has access to the environment can access the file
// uploading private files requires no authentication
// use this to let users upload files to a survey for example
// this api endpoint will return a signed url for uploading the file to s3 and another url for uploading file to the local storage

export async function POST(req: NextRequest): Promise<NextResponse> {
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

  const survey = await getSurvey(surveyId);

  if (!survey) {
    return responses.notFoundResponse("Survey", surveyId);
  }

  const { environmentId } = survey;

  const team = await getTeamByEnvironmentId(environmentId);

  if (!team) {
    return responses.notFoundResponse("TeamByEnvironmentId", environmentId);
  }

  const { plan } = team;

  return await uploadPrivateFile(fileName, environmentId, fileType, plan);
}
