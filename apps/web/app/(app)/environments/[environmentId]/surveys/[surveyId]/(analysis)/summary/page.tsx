export const revalidate = REVALIDATION_INTERVAL;

import { getAnalysisData } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/data";
import SummaryPage from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SummaryPage";
import { authOptions } from "@formbricks/lib/authOptions";
import { REVALIDATION_INTERVAL, TEXT_RESPONSES_PER_PAGE, WEBAPP_URL } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdTeamId } from "@formbricks/lib/membership/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getProfile } from "@formbricks/lib/profile/service";
import { getTagsByEnvironmentId } from "@formbricks/lib/tag/service";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";
import { getServerSession } from "next-auth";
import { translateSurvey } from "@formbricks/lib/utils/i18n";

export default async function Page({ params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error("Unauthorized");
  }

  const [{ responses, survey, displayCount }, environment] = await Promise.all([
    getAnalysisData(params.surveyId, params.environmentId),
    getEnvironment(params.environmentId),
  ]);
  if (!environment) {
    throw new Error("Environment not found");
  }

  const product = await getProductByEnvironmentId(environment.id);
  if (!product) {
    throw new Error("Product not found");
  }

  const profile = await getProfile(session.user.id);
  if (!profile) {
    throw new Error("Profile not found");
  }

  const team = await getTeamByEnvironmentId(params.environmentId);

  if (!team) {
    throw new Error("Team not found");
  }

  const currentUserMembership = await getMembershipByUserIdTeamId(session?.user.id, team.id);

  const tags = await getTagsByEnvironmentId(params.environmentId);

  return (
    <>
      <SummaryPage
        environment={environment}
        responses={responses}
        survey={translateSurvey(survey)}
        surveyId={params.surveyId}
        webAppUrl={WEBAPP_URL}
        product={product}
        profile={profile}
        environmentTags={tags}
        displayCount={displayCount}
        responsesPerPage={TEXT_RESPONSES_PER_PAGE}
        membershipRole={currentUserMembership?.role}
      />
    </>
  );
}
