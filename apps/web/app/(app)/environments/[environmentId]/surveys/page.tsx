import { SurveysList } from "@/app/(app)/environments/[environmentId]/surveys/components/SurveyList";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { getProjectPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { TemplateList } from "@/modules/surveys/components/TemplateList";
import { Button } from "@/modules/ui/components/button";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";
import { PlusIcon } from "lucide-react";
import { Metadata, NextPage } from "next";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SURVEYS_PER_PAGE, WEBAPP_URL } from "@formbricks/lib/constants";
import { getEnvironment, getEnvironments } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProjectByEnvironmentId } from "@formbricks/lib/project/service";
import { getSurveyCount } from "@formbricks/lib/survey/service";
import { getUser } from "@formbricks/lib/user/service";
import { findMatchingLocale } from "@formbricks/lib/utils/locale";
import { TTemplateRole } from "@formbricks/types/templates";

export const metadata: Metadata = {
  title: "Your Surveys",
};

interface SurveyTemplateProps {
  params: Promise<{
    environmentId: string;
  }>;
  searchParams: Promise<{
    role?: TTemplateRole;
  }>;
}

const SurveysPage = async ({ params: paramsProps, searchParams: searchParamsProps }: SurveyTemplateProps) => {
  const searchParams = await searchParamsProps;
  const params = await paramsProps;

  const session = await getServerSession(authOptions);
  const project = await getProjectByEnvironmentId(params.environmentId);
  const organization = await getOrganizationByEnvironmentId(params.environmentId);
  const t = await getTranslate();
  if (!session) {
    throw new Error(t("common.session_not_found"));
  }

  const user = await getUser(session.user.id);
  if (!user) {
    throw new Error(t("common.user_not_found"));
  }

  if (!project) {
    throw new Error(t("common.project_not_found"));
  }

  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }

  const prefilledFilters = [project?.config.channel, project.config.industry, searchParams.role ?? null];

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isMember, isBilling } = getAccessFlags(currentUserMembership?.role);

  const projectPermission = await getProjectPermissionByUserId(session.user.id, project.id);
  const { hasReadAccess } = getTeamPermissionFlags(projectPermission);

  const isReadOnly = isMember && hasReadAccess;

  if (isBilling) {
    return redirect(`/environments/${params.environmentId}/settings/billing`);
  }

  const environment = await getEnvironment(params.environmentId);
  if (!environment) {
    throw new Error(t("common.environment_not_found"));
  }

  const surveyCount = await getSurveyCount(params.environmentId);

  const environments = await getEnvironments(project.id);
  const otherEnvironment = environments.find((e) => e.type !== environment.type)!;

  const currentProjectChannel = project.config.channel ?? null;
  const locale = await findMatchingLocale();
  const CreateSurveyButton = () => {
    return (
      <Button size="sm" asChild>
        <Link href={`/environments/${environment.id}/surveys/templates`}>
          {t("environments.surveys.new_survey")}
          <PlusIcon />
        </Link>
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
            currentProjectChannel={currentProjectChannel}
            locale={locale}
          />
        </>
      ) : isReadOnly ? (
        <>
          <h1 className="px-6 text-3xl font-extrabold text-slate-700">
            {t("environments.surveys.no_surveys_created_yet")}
          </h1>

          <h2 className="px-6 text-lg font-medium text-slate-500">
            {t("environments.surveys.read_only_user_not_allowed_to_create_survey_warning")}
          </h2>
        </>
      ) : (
        <>
          <h1 className="px-6 text-3xl font-extrabold text-slate-700">
            {t("environments.surveys.all_set_time_to_create_first_survey")}
          </h1>
          <TemplateList
            environment={environment}
            project={project}
            user={user}
            prefilledFilters={prefilledFilters}
          />
        </>
      )}
    </PageContentWrapper>
  );
};

export default SurveysPage as NextPage;
