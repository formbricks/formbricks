import { ProjectConfigNavigation } from "@/app/(app)/environments/[environmentId]/project/components/ProjectConfigNavigation";
import {
  getMultiLanguagePermission,
  getRoleManagementPermission,
} from "@/modules/ee/license-check/lib/utils";
import { getProjectPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { SettingsId } from "@/modules/ui/components/settings-id";
import packageJson from "@/package.json";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { authOptions } from "@formbricks/lib/authOptions";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProjectByEnvironmentId } from "@formbricks/lib/project/service";
import { SettingsCard } from "../../settings/components/SettingsCard";
import { DeleteProject } from "./components/DeleteProject";
import { EditProjectNameForm } from "./components/EditProjectNameForm";
import { EditWaitingTimeForm } from "./components/EditWaitingTimeForm";

const Page = async (props: { params: Promise<{ environmentId: string }> }) => {
  const params = await props.params;
  const t = await getTranslations();
  const [project, session, organization] = await Promise.all([
    getProjectByEnvironmentId(params.environmentId),
    getServerSession(authOptions),
    getOrganizationByEnvironmentId(params.environmentId),
  ]);

  if (!project) {
    throw new Error(t("environments.project.general.project_not_found"));
  }
  if (!session) {
    throw new Error(t("common.session_not_found"));
  }
  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const projectPermission = await getProjectPermissionByUserId(session.user.id, project.id);

  const { isMember, isOwner, isManager } = getAccessFlags(currentUserMembership?.role);
  const { hasManageAccess } = getTeamPermissionFlags(projectPermission);

  const isReadOnly = isMember && !hasManageAccess;

  const isMultiLanguageAllowed = await getMultiLanguagePermission(organization);
  const canDoRoleManagement = await getRoleManagementPermission(organization);

  const isOwnerOrManager = isOwner || isManager;

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.configuration")}>
        <ProjectConfigNavigation
          environmentId={params.environmentId}
          activeId="general"
          isMultiLanguageAllowed={isMultiLanguageAllowed}
          canDoRoleManagement={canDoRoleManagement}
        />
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
          project={project}
          isOwnerOrManager={isOwnerOrManager}
        />
      </SettingsCard>
      <div>
        <SettingsId title={t("common.project_id")} id={project.id}></SettingsId>
        {!IS_FORMBRICKS_CLOUD && (
          <SettingsId title={t("common.formbricks_version")} id={packageJson.version}></SettingsId>
        )}
      </div>
    </PageContentWrapper>
  );
};

export default Page;
