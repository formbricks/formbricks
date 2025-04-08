import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { ProjectConfigNavigation } from "@/modules/projects/settings/components/project-config-navigation";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { SettingsId } from "@/modules/ui/components/settings-id";
import packageJson from "@/package.json";
import { getTranslate } from "@/tolgee/server";
import { IS_DEVELOPMENT, IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { getProjects } from "@formbricks/lib/project/service";
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
      <PageHeader pageTitle={t("common.project_configuration")}>
        <ProjectConfigNavigation environmentId={params.environmentId} activeId="general" />
      </PageHeader>
      <SettingsCard
        title={t("common.project_name")}
        description={t("environments.project.general.project_name_settings_description")}>
        <EditProjectNameForm project={project} isReadOnly={isReadOnly} />
      </SettingsCard>
      <SettingsCard
        title={t("environments.project.general.recontact_waiting_time")}
        description={t("environments.project.general.recontact_waiting_time_settings_description")}>
        <EditWaitingTimeForm project={project} isReadOnly={isReadOnly} />
      </SettingsCard>
      <SettingsCard
        title={t("environments.project.general.delete_project")}
        description={t("environments.project.general.delete_project_settings_description")}>
        <DeleteProject
          environmentId={params.environmentId}
          currentProject={project}
          organizationProjects={organizationProjects}
          isOwnerOrManager={isOwnerOrManager}
        />
      </SettingsCard>
      <div>
        <SettingsId title={t("common.project_id")} id={project.id}></SettingsId>
        {!IS_FORMBRICKS_CLOUD && !IS_DEVELOPMENT && (
          <SettingsId title={t("common.formbricks_version")} id={packageJson.version}></SettingsId>
        )}
      </div>
    </PageContentWrapper>
  );
};
