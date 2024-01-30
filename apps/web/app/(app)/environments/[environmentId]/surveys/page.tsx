import WidgetStatusIndicator from "@/app/(app)/environments/[environmentId]/components/WidgetStatusIndicator";
import SurveyStarter from "@/app/(app)/environments/[environmentId]/surveys/components/SurveyStarter";
import { Metadata } from "next";
import { getServerSession } from "next-auth";

import { authOptions } from "@formbricks/lib/authOptions";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getEnvironments } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdTeamId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getSurveys } from "@formbricks/lib/survey/service";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";
import ContentWrapper from "@formbricks/ui/ContentWrapper";
import SurveysList from "@formbricks/ui/SurveysList";

export const metadata: Metadata = {
  title: "Your Surveys",
};

export default async function SurveysPage({ params }) {
  const session = await getServerSession(authOptions);
  const product = await getProductByEnvironmentId(params.environmentId);
  const team = await getTeamByEnvironmentId(params.environmentId);
  if (!session) {
    throw new Error("Session not found");
  }

  if (!product) {
    throw new Error("Product not found");
  }

  if (!team) {
    throw new Error("Team not found");
  }

  const currentUserMembership = await getMembershipByUserIdTeamId(session?.user.id, team.id);
  const { isViewer } = getAccessFlags(currentUserMembership?.role);

  const environment = await getEnvironment(params.environmentId);
  if (!environment) {
    throw new Error("Environment not found");
  }
  const surveys = await getSurveys(params.environmentId);

  const environments = await getEnvironments(product.id);
  const otherEnvironment = environments.find((e) => e.type !== environment.type)!;

  return (
    <ContentWrapper className="flex h-full flex-col justify-between">
      {surveys.length > 0 ? (
        <SurveysList
          environment={environment}
          surveys={surveys}
          otherEnvironment={otherEnvironment}
          isViewer={isViewer}
          WEBAPP_URL={WEBAPP_URL}
          userId={session.user.id}
        />
      ) : (
        <SurveyStarter
          environmentId={params.environmentId}
          environment={environment}
          product={product}
          user={session.user}
        />
      )}
      {/* <SurveysList environmentId={params.environmentId} />   */}
      <WidgetStatusIndicator environmentId={params.environmentId} type="mini" />
    </ContentWrapper>
  );
}
