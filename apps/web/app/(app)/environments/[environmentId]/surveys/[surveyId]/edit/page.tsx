export const revalidate = REVALIDATION_INTERVAL;
import { getActionClasses } from "@formbricks/lib/actionClass/service";
import { getAttributeClasses } from "@formbricks/lib/attributeClass/service";
import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getResponseCountBySurveyId } from "@formbricks/lib/response/service";
import { getSurvey } from "@formbricks/lib/survey/service";
import { ErrorComponent } from "@formbricks/ui/ErrorComponent";
import SurveyEditor from "./components/SurveyEditor";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";
import { getMembershipByUserIdTeamId } from "@formbricks/lib/membership/service";
import { getServerSession } from "next-auth";
import { authOptions } from "@formbricks/lib/authOptions";

export default async function SurveysEditPage({ params }) {
  const [survey, product, environment, actionClasses, attributeClasses, responseCount, team, session] =
    await Promise.all([
      getSurvey(params.surveyId),
      getProductByEnvironmentId(params.environmentId),
      getEnvironment(params.environmentId),
      getActionClasses(params.environmentId),
      getAttributeClasses(params.environmentId),
      getResponseCountBySurveyId(params.surveyId),
      getTeamByEnvironmentId(params.environmentId),
      getServerSession(authOptions),
    ]);

  if (!session) {
    throw new Error("Session not found");
  }

  if (!team) {
    throw new Error("Team not found");
  }

  const currentUserMembership = await getMembershipByUserIdTeamId(session?.user.id, team.id);
  const isSurveyCreationDeletionDisabled = currentUserMembership?.role === "viewer";

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
    <>
      <SurveyEditor
        survey={survey}
        product={product}
        environment={environment}
        actionClasses={actionClasses}
        attributeClasses={attributeClasses}
        responseCount={responseCount}
      />
    </>
  );
}
