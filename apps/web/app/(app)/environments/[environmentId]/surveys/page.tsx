import { SurveyStarter } from "@/app/(app)/environments/[environmentId]/surveys/components/SurveyStarter";
import { PlusIcon } from "lucide-react";
import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@formbricks/lib/authOptions";
import { SURVEYS_PER_PAGE, WEBAPP_URL } from "@formbricks/lib/constants";
import { getEnvironment, getEnvironments } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getSurveyCount } from "@formbricks/lib/survey/service";
import { TProductIndustry } from "@formbricks/types/product";
import { TSurveyType } from "@formbricks/types/surveys";
import { TTemplateRole } from "@formbricks/types/templates";
import { Button } from "@formbricks/ui/Button";
import { PageContentWrapper } from "@formbricks/ui/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/PageHeader";
import { SurveysList } from "@formbricks/ui/SurveysList";

export const metadata: Metadata = {
  title: "Your Surveys",
};

interface SurveyTemplateProps {
  params: {
    environmentId: string;
  };
  searchParams: {
    channel?: TSurveyType;
    industry?: TProductIndustry;
    role?: TTemplateRole;
  };
}

const Page = async ({ params, searchParams }: SurveyTemplateProps) => {
  const session = await getServerSession(authOptions);
  const product = await getProductByEnvironmentId(params.environmentId);
  const organization = await getOrganizationByEnvironmentId(params.environmentId);
  const prefilledFilters = [
    searchParams.channel ?? null,
    searchParams.industry ?? null,
    searchParams.role ?? null,
  ];
  if (!session) {
    throw new Error("Session not found");
  }

  if (!product) {
    throw new Error("Product not found");
  }

  if (!organization) {
    throw new Error("Organization not found");
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
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
          <PageHeader pageTitle="Surveys" cta={isViewer ? <></> : CreateSurveyButton} />
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
          prefilledFilters={prefilledFilters}
        />
      )}
    </PageContentWrapper>
  );
};

export default Page;
