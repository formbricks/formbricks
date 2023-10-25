"use server";

import { getServerSession } from "next-auth";
import { AuthorizationError } from "@formbricks/types/errors";
import { authOptions } from "@formbricks/lib/authOptions";
import { getSurveysByAttributeClassId } from "@formbricks/lib/survey/service";
import { canUserAccessAttributeClass } from "@formbricks/lib/attributeClass/auth";

export const GetActiveInactiveSurveysAction = async (
  attributeClassId: string
): Promise<{ activeSurveys: string[]; inactiveSurveys: string[] }> => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessAttributeClass(session.user.id, attributeClassId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const surveys = await getSurveysByAttributeClassId(attributeClassId);
  const response = {
    activeSurveys: surveys.filter((s) => s.status === "inProgress").map((survey) => survey.name),
    inactiveSurveys: surveys.filter((s) => s.status !== "inProgress").map((survey) => survey.name),
  };
  return response;
};
