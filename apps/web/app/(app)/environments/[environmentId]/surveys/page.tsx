import { SurveysList } from "@/app/(app)/environments/[environmentId]/surveys/components/SurveyList";
import { PlusIcon } from "lucide-react";
import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { useTranslations } from "next-intl";
import { authOptions } from "@formbricks/lib/authOptions";
import { SURVEYS_PER_PAGE, WEBAPP_URL } from "@formbricks/lib/constants";
import { getEnvironment, getEnvironments } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getSurveyCount } from "@formbricks/lib/survey/service";
import { getUser } from "@formbricks/lib/user/service";
import { TTemplateRole } from "@formbricks/types/templates";
import { Button } from "@formbricks/ui/components/Button";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";
import { TemplateList } from "@formbricks/ui/components/TemplateList";

export const metadata: Metadata = {
  title: "Your Surveys",
};

interface SurveyTemplateProps {
  params: {
    environmentId: string;
  };
  searchParams: {
    role?: TTemplateRole;
  };
}

const Page = async ({ params, searchParams }: SurveyTemplateProps) => {
  const session = await getServerSession(authOptions);
  const product = await getProductByEnvironmentId(params.environmentId);
  const organization = await getOrganizationByEnvironmentId(params.environmentId);
  if (!session) {
    throw new Error("Session not found");
  }

  const user = await getUser(session.user.id);
  if (!user) {
    throw new Error("User not found");
  }

  if (!product) {
    throw new Error("Product not found");
  }

  if (!organization) {
    throw new Error("Organization not found");
  }

  const prefilledFilters = [product?.config.channel, product.config.industry, searchParams.role ?? null];

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isViewer } = getAccessFlags(currentUserMembership?.role);

  const environment = await getEnvironment(params.environmentId);
  if (!environment) {
    throw new Error("Environment not found");
  }

  const surveyCount = await getSurveyCount(params.environmentId);

  const environments = await getEnvironments(product.id);
  const otherEnvironment = environments.find((e) => e.type !== environment.type)!;

  const currentProductChannel = product.config.channel ?? null;

  const CreateSurveyButton = () => {
    const t = useTranslations();
    return (
      <Button size="sm" href={`/environments/${environment.id}/surveys/templates`} EndIcon={PlusIcon}>
        {t("new_survey")}
      </Button>
    );
  };

  return (
    <PageContentWrapper>
      {surveyCount > 0 ? (
        <>
          <PageHeader pageTitle="surveys" cta={isViewer ? <></> : <CreateSurveyButton />} />
          <SurveysList
            environment={environment}
            otherEnvironment={otherEnvironment}
            isViewer={isViewer}
            WEBAPP_URL={WEBAPP_URL}
            userId={session.user.id}
            surveysPerPage={SURVEYS_PER_PAGE}
            currentProductChannel={currentProductChannel}
          />
        </>
      ) : isViewer ? (
        <>
          <h1 className="px-6 text-3xl font-extrabold text-slate-700">No surveys created yet.</h1>

          <h2 className="px-6 text-lg font-medium text-slate-500">
            As a Viewer you are not allowed to create surveys. Please ask an Editor to create a survey or an
            Admin to upgrade your role.
          </h2>
        </>
      ) : (
        <>
          <h1 className="px-6 text-3xl font-extrabold text-slate-700">
            You&apos;re all set! Time to create your first survey.
          </h1>
          <TemplateList
            environment={environment}
            product={product}
            user={user}
            prefilledFilters={prefilledFilters}
          />
        </>
      )}
    </PageContentWrapper>
  );
};

export default Page;
