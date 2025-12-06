import { getServerSession } from "next-auth";
import { getTranslate } from "@/lingodotdev/server";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { getTeamRoleByTeamIdUserId } from "@/modules/ee/teams/lib/roles";
import { AccessView } from "@/modules/ee/teams/project-teams/components/access-view";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { ProjectConfigNavigation } from "@/modules/projects/settings/components/project-config-navigation";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTeamsByProjectId } from "./lib/team";

export const ProjectTeams = async (props: { params: Promise<{ environmentId: string }> }) => {
  const t = await getTranslate();
  const params = await props.params;

  const { project, isOwner, isManager } = await getEnvironmentAuth(params.environmentId);

  const teams = await getTeamsByProjectId(project.id);

  if (!teams) {
    throw new Error(t("common.teams_not_found"));
  }

  const isOwnerOrManager = isOwner || isManager;

  // Check if user is a team admin of any team that has access to this project
  const session = await getServerSession(authOptions);
  let isTeamAdmin = false;
  if (session?.user?.id) {
    for (const team of teams) {
      const teamRole = await getTeamRoleByTeamIdUserId(team.id, session.user.id);
      if (teamRole === "admin") {
        isTeamAdmin = true;
        break;
      }
    }
  }

  const canManageTeams = isOwnerOrManager || isTeamAdmin;

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.project_configuration")}>
        <ProjectConfigNavigation environmentId={params.environmentId} activeId="teams" />
      </PageHeader>
      <AccessView environmentId={params.environmentId} teams={teams} canManageTeams={canManageTeams} />
    </PageContentWrapper>
  );
};
