import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getProjects } from "@/lib/project/service";
import { getTranslate } from "@/lingodotdev/server";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { ProjectConfigNavigation } from "@/modules/projects/settings/components/project-config-navigation";
import { IdBadge } from "@/modules/ui/components/id-badge";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { CustomScriptsForm } from "./components/custom-scripts-form";
import { DeleteProject } from "./components/delete-project";
import { EditProjectNameForm } from "./components/edit-project-name-form";
import { EditWaitingTimeForm } from "./components/edit-waiting-time-form";

export const GeneralSettingsPage = async (props: { params: Promise<{ environmentId: string }> }) => {
  const params = await props.params;
  const t = await getTranslate();

  const { isReadOnly, isOwner, isManager, project, organization } = await getEnvironmentAuth(
    params.environmentId
  );

  const organizationProjects = await getProjects(organization.id);

  const isOwnerOrManager = isOwner || isManager;

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.workspace_configuration")}>
        <ProjectConfigNavigation environmentId={params.environmentId} activeId="general" />
      </PageHeader>
      <SettingsCard
        title={t("common.workspace_name")}
        description={t("environments.workspace.general.workspace_name_settings_description")}>
        <EditProjectNameForm project={project} isReadOnly={isReadOnly} />
      </SettingsCard>
      <SettingsCard
        title={t("environments.workspace.general.recontact_waiting_time")}
        description={t("environments.workspace.general.recontact_waiting_time_settings_description")}>
        <EditWaitingTimeForm project={project} isReadOnly={isReadOnly} />
      </SettingsCard>
      {!IS_FORMBRICKS_CLOUD && (
        <SettingsCard
          title={t("environments.workspace.general.custom_scripts")}
          description={t("environments.workspace.general.custom_scripts_card_description")}>
          <CustomScriptsForm project={project} isReadOnly={!isOwnerOrManager} />
        </SettingsCard>
      )}
      <SettingsCard
        title={t("environments.workspace.general.delete_workspace")}
        description={t("environments.workspace.general.delete_workspace_settings_description")}>
        <DeleteProject
          environmentId={params.environmentId}
          currentProject={project}
          organizationProjects={organizationProjects}
          isOwnerOrManager={isOwnerOrManager}
        />
      </SettingsCard>
      <div className="space-y-2">
        <IdBadge id={project.id} label={t("common.workspace_id")} variant="column" />
      </div>
    </PageContentWrapper>
  );
};
