import { AccessView } from "@/modules/ee/teams/project-teams/components/access-view";
import { getEnvironmentAuth } from "@/modules/environments/lib/fetcher";
import { ProjectConfigNavigation } from "@/modules/projects/settings/components/project-config-navigation";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";
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

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.project_configuration")}>
        <ProjectConfigNavigation environmentId={params.environmentId} activeId="teams" />
      </PageHeader>
      <AccessView environmentId={params.environmentId} teams={teams} isOwnerOrManager={isOwnerOrManager} />
    </PageContentWrapper>
  );
};
