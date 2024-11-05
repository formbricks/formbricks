import { SurveysList } from "@/app/(app)/environments/[environmentId]/surveys/components/SurveyList";
import { getProductPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { TemplateList } from "@/modules/surveys/components/TemplateList";
import { PlusIcon } from "lucide-react";
import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { authOptions } from "@formbricks/lib/authOptions";
import { SURVEYS_PER_PAGE, WEBAPP_URL } from "@formbricks/lib/constants";
import { getEnvironment, getEnvironments } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getSurveyCount } from "@formbricks/lib/survey/service";
import { getUser } from "@formbricks/lib/user/service";
import { findMatchingLocale } from "@formbricks/lib/utils/locale";
import { TTemplateRole } from "@formbricks/types/templates";
import { Button } from "@formbricks/ui/components/Button";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";

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
  const t = await getTranslations();
  if (!session) {
    throw new Error(t("common.session_not_found"));
  }

  const user = await getUser(session.user.id);
  if (!user) {
    throw new Error(t("common.user_not_found"));
  }

  if (!product) {
    throw new Error(t("common.product_not_found"));
  }

  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }

  const prefilledFilters = [product?.config.channel, product.config.industry, searchParams.role ?? null];

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isMember, isBilling } = getAccessFlags(currentUserMembership?.organizationRole);

  const productPermission = await getProductPermissionByUserId(session.user.id, product.id);
  const { hasReadAccess } = getTeamPermissionFlags(productPermission);

  const isReadOnly = isMember && hasReadAccess;

  if (isBilling) {
    return redirect(`/environments/${params.environmentId}/settings/billing`);
  }

  const environment = await getEnvironment(params.environmentId);
  if (!environment) {
    throw new Error(t("common.environment_not_found"));
  }

  const surveyCount = await getSurveyCount(params.environmentId);

  const environments = await getEnvironments(product.id);
  const otherEnvironment = environments.find((e) => e.type !== environment.type)!;

  const currentProductChannel = product.config.channel ?? null;
  const locale = await findMatchingLocale();
  const CreateSurveyButton = () => {
    return (
      <Button size="sm" href={`/environments/${environment.id}/surveys/templates`} EndIcon={PlusIcon}>
        {t("environments.surveys.new_survey")}
      </Button>
    );
  };

  return (
    <PageContentWrapper>
      {surveyCount > 0 ? (
        <>
          <PageHeader pageTitle={t("common.surveys")} cta={isReadOnly ? <></> : <CreateSurveyButton />} />
          <SurveysList
            environment={environment}
            otherEnvironment={otherEnvironment}
            isReadOnly={isReadOnly}
            WEBAPP_URL={WEBAPP_URL}
            userId={session.user.id}
            surveysPerPage={SURVEYS_PER_PAGE}
            currentProductChannel={currentProductChannel}
            locale={locale}
          />
        </>
      ) : isReadOnly ? (
        <>
          <h1 className="px-6 text-3xl font-extrabold text-slate-700">
            {t("environments.surveys.no_surveys_created_yet")}
          </h1>

          <h2 className="px-6 text-lg font-medium text-slate-500">
            {t("environments.surveys.viewer_not_allowed_to_create_survey_warning")}
          </h2>
        </>
      ) : (
        <>
          <h1 className="px-6 text-3xl font-extrabold text-slate-700">
            {t("environments.surveys.all_set_time_to_create_first_survey")}
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
