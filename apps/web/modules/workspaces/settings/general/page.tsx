import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getWorkspaces } from "@/lib/workspace/service";
import { getTranslate } from "@/lingodotdev/server";
import { IdBadge } from "@/modules/ui/components/id-badge";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { CustomScriptsForm } from "./components/custom-scripts-form";
import { DeleteWorkspace } from "./components/delete-workspace";
import { EditCooldownPeriodForm } from "./components/edit-cooldown-period-form";
import { EditWorkspaceNameForm } from "./components/edit-workspace-name-form";

export const GeneralSettingsPage = async (props: { params: Promise<{ workspaceId: string }> }) => {
  const params = await props.params;
  const t = await getTranslate();

  const { isReadOnly, isOwner, isManager, workspace, organization } = await getWorkspaceAuth(
    params.workspaceId
  );

  const organizationWorkspaces = await getWorkspaces(organization.id);

  const isOwnerOrManager = isOwner || isManager;

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.workspace_settings")} />
      <SettingsCard
        title={t("common.workspace_name")}
        description={t("workspace.general.workspace_name_settings_description")}>
        <EditWorkspaceNameForm workspace={workspace} isReadOnly={isReadOnly} />
      </SettingsCard>
      <SettingsCard
        title={t("workspace.general.recontact_cooldown_period")}
        description={t("workspace.general.recontact_cooldown_period_settings_description")}>
        <EditCooldownPeriodForm workspace={workspace} isReadOnly={isReadOnly} />
      </SettingsCard>
      {!IS_FORMBRICKS_CLOUD && (
        <SettingsCard
          title={t("workspace.general.custom_scripts")}
          description={t("workspace.general.custom_scripts_card_description")}>
          <CustomScriptsForm workspace={workspace} isReadOnly={!isOwnerOrManager} />
        </SettingsCard>
      )}
      <SettingsCard
        title={t("workspace.general.delete_workspace")}
        description={t("workspace.general.delete_workspace_settings_description")}>
        <DeleteWorkspace
          organizationId={organization.id}
          currentWorkspace={workspace}
          organizationWorkspaces={organizationWorkspaces}
          isOwnerOrManager={isOwnerOrManager}
        />
      </SettingsCard>
      <div className="space-y-2">
        <IdBadge id={workspace.id} label={t("common.workspace_id")} variant="column" />
      </div>
    </PageContentWrapper>
  );
};
