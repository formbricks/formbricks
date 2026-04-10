import { ResourceNotFoundError } from "@formbricks/types/errors";
import { getTranslate } from "@/lingodotdev/server";
import { AccessView } from "@/modules/ee/teams/workspace-teams/components/access-view";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { WorkspaceConfigNavigation } from "@/modules/workspaces/settings/components/workspace-config-navigation";
import { getTeamsByWorkspaceId } from "./lib/team";

export const WorkspaceTeams = async (props: { params: Promise<{ workspaceId: string }> }) => {
  const t = await getTranslate();
  const params = await props.params;

  const { workspace } = await getWorkspaceAuth(params.workspaceId);

  const teams = await getTeamsByWorkspaceId(workspace.id);

  if (!teams) {
    throw new ResourceNotFoundError(t("common.teams"), null);
  }

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.workspace_configuration")}>
        <WorkspaceConfigNavigation activeId="teams" />
      </PageHeader>
      <AccessView teams={teams} />
    </PageContentWrapper>
  );
};
