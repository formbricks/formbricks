import { getServerSession } from "next-auth";

import { getActionClasses } from "@formbricks/lib/actionClass/service";
import { getAttributeClasses } from "@formbricks/lib/attributeClass/service";
import { authOptions } from "@formbricks/lib/authOptions";
import { colours } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdTeamId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getResponseCountBySurveyId } from "@formbricks/lib/response/service";
import { getSurvey } from "@formbricks/lib/survey/service";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";
import { getUserSegments } from "@formbricks/lib/userSegment/service";
import { ErrorComponent } from "@formbricks/ui/ErrorComponent";

import SurveyEditor from "./components/SurveyEditor";

export const generateMetadata = async ({ params }) => {
  const survey = await getSurvey(params.surveyId);
  return {
    title: survey?.name ? `${survey?.name} | Editor` : "Editor",
  };
};

export default async function SurveysEditPage({ params }) {
  const [
    survey,
    product,
    environment,
    actionClasses,
    attributeClasses,
    responseCount,
    team,
    session,
    userSegments,
  ] = await Promise.all([
    getSurvey(params.surveyId),
    getProductByEnvironmentId(params.environmentId),
    getEnvironment(params.environmentId),
    getActionClasses(params.environmentId),
    getAttributeClasses(params.environmentId),
    getResponseCountBySurveyId(params.surveyId),
    getTeamByEnvironmentId(params.environmentId),
    getServerSession(authOptions),
    getUserSegments(params.environmentId),
  ]);

  if (!session) {
    throw new Error("Session not found");
  }

  if (!team) {
    throw new Error("Team not found");
  }

  const currentUserMembership = await getMembershipByUserIdTeamId(session?.user.id, team.id);
  const { isViewer } = getAccessFlags(currentUserMembership?.role);
  const isSurveyCreationDeletionDisabled = isViewer;

  if (
    !survey ||
    !environment ||
    !actionClasses ||
    !attributeClasses ||
    !product ||
    isSurveyCreationDeletionDisabled
  ) {
    return <ErrorComponent />;
  }

  return (
    <SurveyEditor
      survey={survey}
      product={product}
      environment={environment}
      actionClasses={actionClasses}
      attributeClasses={attributeClasses}
      responseCount={responseCount}
      membershipRole={currentUserMembership?.role}
      colours={colours}
      userSegments={userSegments}
    />
  );
}
