import { authOptions } from "@/modules/auth/lib/authOptions";
import { getProjectPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { getTranslate } from "@/tolgee/server";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getProjectByEnvironmentId } from "@formbricks/lib/project/service";
import { getUser } from "@formbricks/lib/user/service";
import { TProjectConfigChannel, TProjectConfigIndustry } from "@formbricks/types/project";
import { TTemplateRole } from "@formbricks/types/templates";
import { TemplateContainerWithPreview } from "./components/TemplateContainer";

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

const Page = async (props: SurveyTemplateProps) => {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const t = await getTranslate();
  const session = await getServerSession(authOptions);
  const environmentId = params.environmentId;

  if (!session) {
    throw new Error(t("common.session_not_found"));
  }

  const [user, environment, project] = await Promise.all([
    getUser(session.user.id),
    getEnvironment(environmentId),
    getProjectByEnvironmentId(environmentId),
  ]);

  if (!user) {
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
      environmentId={environmentId}
      user={user}
      environment={environment}
      project={project}
      prefilledFilters={prefilledFilters}
      // AI Survey Creation -- Need improvement
      isAIEnabled={false}
    />
  );
};

export default Page;
