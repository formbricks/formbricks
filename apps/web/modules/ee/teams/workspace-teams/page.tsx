import { getTranslate } from "@/lingodotdev/server";
import { AccessView } from "@/modules/ee/teams/workspace-teams/components/access-view";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { WorkspaceConfigNavigation } from "@/modules/workspaces/settings/components/workspace-config-navigation";
import { getTeamsByWorkspaceId } from "./lib/team";

export const WorkspaceTeams = async (props: { params: Promise<{ environmentId: string }> }) => {
  const t = await getTranslate();
  const params = await props.params;

  const { workspace } = await getEnvironmentAuth(params.environmentId);

  const teams = await getTeamsByWorkspaceId(workspace.id);

  if (!teams) {
    throw new Error(t("common.teams_not_found"));
  }

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.workspace_configuration")}>
        <WorkspaceConfigNavigation environmentId={params.environmentId} activeId="teams" />
      </PageHeader>
      <AccessView environmentId={params.environmentId} teams={teams} />
    </PageContentWrapper>
  );
};
