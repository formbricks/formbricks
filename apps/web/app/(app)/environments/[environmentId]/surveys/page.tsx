import { SurveyStarter } from "@/app/(app)/environments/[environmentId]/surveys/components/SurveyStarter";
import { PlusIcon } from "lucide-react";
import { Metadata } from "next";
import { getServerSession } from "next-auth";

import { authOptions } from "@formbricks/lib/authOptions";
import { SURVEYS_PER_PAGE, WEBAPP_URL } from "@formbricks/lib/constants";
import { getEnvironment, getEnvironments } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdTeamId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getSurveyCount } from "@formbricks/lib/survey/service";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";
import { Button } from "@formbricks/ui/Button";
import { PageContentWrapper } from "@formbricks/ui/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/PageHeader";
import { SurveysList } from "@formbricks/ui/SurveysList";

export const metadata: Metadata = {
  title: "Your Surveys",
};

const Page = async ({ params }) => {
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

  const surveyCount = await getSurveyCount(params.environmentId);

  const environments = await getEnvironments(product.id);
  const otherEnvironment = environments.find((e) => e.type !== environment.type)!;

  const CreateSurveyButton = (
    <Button
      size="sm"
      href={`/environments/${environment.id}/surveys/templates`}
      variant="darkCTA"
      EndIcon={PlusIcon}>
      New survey
    </Button>
  );

  return (
    <PageContentWrapper>
      {surveyCount > 0 ? (
        <>
          <PageHeader pageTitle="Surveys" cta={CreateSurveyButton} />
          <SurveysList
            environment={environment}
            otherEnvironment={otherEnvironment}
            isViewer={isViewer}
            WEBAPP_URL={WEBAPP_URL}
            userId={session.user.id}
            surveysPerPage={SURVEYS_PER_PAGE}
          />
        </>
      ) : (
        <SurveyStarter
          environmentId={params.environmentId}
          environment={environment}
          product={product}
          user={session.user}
        />
      )}
    </PageContentWrapper>
  );
};

export default Page;
