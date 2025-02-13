import { authOptions } from "@/modules/auth/lib/authOptions";
import { getProjectPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { getEnvironment } from "@/modules/survey/lib/environment";
import { getMembershipRoleByUserIdOrganizationId } from "@/modules/survey/lib/membership";
import { getProjectByEnvironmentId } from "@/modules/survey/lib/project";
import { getTranslate } from "@/tolgee/server";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { TProjectConfigChannel, TProjectConfigIndustry } from "@formbricks/types/project";
import { TTemplateRole } from "@formbricks/types/templates";
import { TemplateContainerWithPreview } from "./components/template-container";

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
  const t = await getTranslate();
  const session = await getServerSession(authOptions);
  const environmentId = params.environmentId;

  if (!session) {
    throw new Error(t("common.session_not_found"));
  }

  const [environment, project] = await Promise.all([
    getEnvironment(environmentId),
    getProjectByEnvironmentId(environmentId),
  ]);

  if (!project) {
    throw new Error(t("common.project_not_found"));
  }

  if (!environment) {
    throw new Error(t("common.environment_not_found"));
  }
  const membershipRole = await getMembershipRoleByUserIdOrganizationId(
    session?.user.id,
    project.organizationId
  );
  const { isMember } = getAccessFlags(membershipRole);

  const projectPermission = await getProjectPermissionByUserId(session.user.id, project.id);
  const { hasReadAccess } = getTeamPermissionFlags(projectPermission);

  const isReadOnly = isMember && hasReadAccess;
  if (isReadOnly) {
    return redirect(`/environments/${environment.id}/surveys`);
  }

  const prefilledFilters = [project.config.channel, project.config.industry, searchParams.role ?? null];

  return (
    <TemplateContainerWithPreview
      userId={session.user.id}
      environment={environment}
      project={project}
      prefilledFilters={prefilledFilters}
      // AI Survey Creation -- Need improvement
      isAIEnabled={false}
    />
  );
};
