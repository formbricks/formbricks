import { authOptions } from "@/modules/auth/lib/authOptions";
import { AccessView } from "@/modules/ee/teams/project-teams/components/access-view";
import { ProjectConfigNavigation } from "@/modules/projects/settings/components/project-config-navigation";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";
import { getServerSession } from "next-auth";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProjectByEnvironmentId } from "@formbricks/lib/project/service";
import { getTeamsByProjectId } from "./lib/team";

export const ProjectTeams = async (props: { params: Promise<{ environmentId: string }> }) => {
  const t = await getTranslate();
  const params = await props.params;
  const [project, session, organization] = await Promise.all([
    getProjectByEnvironmentId(params.environmentId),
    getServerSession(authOptions),
    getOrganizationByEnvironmentId(params.environmentId),
  ]);

  if (!project) {
    throw new Error(t("common.project_not_found"));
  }
  if (!session) {
    throw new Error(t("common.session_not_found"));
  }
  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isOwner, isManager } = getAccessFlags(currentUserMembership?.role);

  const teams = await getTeamsByProjectId(project.id);

  if (!teams) {
    throw new Error(t("common.teams_not_found"));
  }

  const isOwnerOrManager = isOwner || isManager;

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.project_configuration")}>
        <ProjectConfigNavigation environmentId={params.environmentId} activeId="teams" />
      </PageHeader>
      <AccessView environmentId={params.environmentId} teams={teams} isOwnerOrManager={isOwnerOrManager} />
    </PageContentWrapper>
  );
};
