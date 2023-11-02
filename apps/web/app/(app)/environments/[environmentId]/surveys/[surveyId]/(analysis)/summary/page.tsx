export const revalidate = REVALIDATION_INTERVAL;

import { getAnalysisData } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/data";
import SummaryPage from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SummaryPage";
import { authOptions } from "@formbricks/lib/authOptions";
import { OPEN_TEXT_RESPONSES_PER_PAGE, REVALIDATION_INTERVAL, WEBAPP_URL } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getProfile } from "@formbricks/lib/profile/service";
import { getTagsByEnvironmentId } from "@formbricks/lib/tag/service";
import { getServerSession } from "next-auth";

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

  const tags = await getTagsByEnvironmentId(params.environmentId);

  return (
    <>
      <SummaryPage
        environment={environment}
        responses={responses}
        survey={survey}
        surveyId={params.surveyId}
        webAppUrl={WEBAPP_URL}
        product={product}
        profile={profile}
        environmentTags={tags}
        displayCount={displayCount}
        responsesPerPage={OPEN_TEXT_RESPONSES_PER_PAGE}
      />
    </>
  );
}
