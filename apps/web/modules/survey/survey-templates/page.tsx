import { authOptions } from "@/modules/auth/lib/authOptions";
import { getProjectPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { getProjectByEnvironmentId } from "@/modules/survey/survey-templates/lib/project";
import { getUserLocale } from "@/modules/survey/survey-templates/lib/user";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { TProjectConfigChannel, TProjectConfigIndustry } from "@formbricks/types/project";
import { TTemplateRole } from "@formbricks/types/templates";
import { TemplateContainerWithPreview } from "./components/template-container";
import { getEnvironment } from "./lib/environment";

interface SurveyTemplateProps {
  params: Promise<{
    environmentId: string;
  }>;
  searchParams: Promise<{
    channel?: TProjectConfigChannel;
    industry?: TProjectConfigIndustry;
    role?: TTemplateRole;
  }>;
}

export const SurveyTemplatesPage = async (props: SurveyTemplateProps) => {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const t = await getTranslations();
  const session = await getServerSession(authOptions);
  const environmentId = params.environmentId;

  if (!session) {
    throw new Error(t("common.session_not_found"));
  }

  const [userLocale, environment, project] = await Promise.all([
    getUserLocale(session.user.id),
    getEnvironment(environmentId),
    getProjectByEnvironmentId(environmentId),
  ]);

  if (!userLocale) {
    throw new Error(t("common.user_not_found"));
  }

  if (!project) {
    throw new Error(t("common.project_not_found"));
  }

  if (!environment) {
    throw new Error(t("common.environment_not_found"));
  }
  const currentUserMembership = await getMembershipByUserIdOrganizationId(
    session?.user.id,
    project.organizationId
  );
  const { isMember } = getAccessFlags(currentUserMembership?.role);

  const projectPermission = await getProjectPermissionByUserId(session.user.id, project.id);
  const { hasReadAccess } = getTeamPermissionFlags(projectPermission);

  const isReadOnly = isMember && hasReadAccess;
  if (isReadOnly) {
    return redirect(`/environments/${environment.id}/surveys`);
  }

  const prefilledFilters = [project.config.channel, project.config.industry, searchParams.role ?? null];

  return (
    <TemplateContainerWithPreview
      userLocale={userLocale}
      userId={session.user.id}
      environment={environment}
      project={project}
      prefilledFilters={prefilledFilters}
      // AI Survey Creation -- Need improvement
      isAIEnabled={false}
    />
  );
};
