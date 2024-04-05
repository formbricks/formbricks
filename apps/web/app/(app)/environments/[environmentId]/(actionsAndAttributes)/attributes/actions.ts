"use server";

import { getServerSession } from "next-auth";

import { canUserAccessAttributeClass } from "@formbricks/lib/attributeClass/auth";
import { authOptions } from "@formbricks/lib/authOptions";
import { getSegmentsByAttributeClassName } from "@formbricks/lib/segment/service";
import { TAttributeClass } from "@formbricks/types/attributeClasses";
import { AuthorizationError } from "@formbricks/types/errors";

export const getSegmentsByAttributeClassAction = async (
  environmentId: string,
  attributeClass: TAttributeClass
): Promise<{ activeSurveys: string[]; inactiveSurveys: string[] }> => {
  try {
    const session = await getServerSession(authOptions);
    if (!session) throw new AuthorizationError("Not authorized");

    const isAuthorized = await canUserAccessAttributeClass(session.user.id, attributeClass.id);
    if (!isAuthorized) throw new AuthorizationError("Not authorized");
    const segments = await getSegmentsByAttributeClassName(environmentId, attributeClass.name);

    // segments is an array of segments, each segment has a survey array with objects with properties: id, name and status.
    // We need the name of the surveys only and we need to filter out the surveys that are both in progress and not in progress.

    const activeSurveys = segments
      .map((segment) =>
        segment.surveys.filter((survey) => survey.status === "inProgress").map((survey) => survey.name)
      )
      .flat();
    const inactiveSurveys = segments
      .map((segment) =>
        segment.surveys.filter((survey) => survey.status !== "inProgress").map((survey) => survey.name)
      )
      .flat();

    return { activeSurveys, inactiveSurveys };
  } catch (err) {
    console.error(`Error getting segments by attribute class: ${err}`);
    throw err;
  }
};
