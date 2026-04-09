import { OrganizationSettingsNavbar } from "@/app/(app)/workspaces/[workspaceId]/settings/(organization)/components/OrganizationSettingsNavbar";
import { isInstanceAIConfigured } from "@/lib/ai/service";
import { FB_LOGO_URL, IS_FORMBRICKS_CLOUD, IS_STORAGE_CONFIGURED } from "@/lib/constants";
import { getUser } from "@/lib/user/service";
import { getTranslate } from "@/lingodotdev/server";
import { getIsMultiOrgEnabled, getWhiteLabelPermission } from "@/modules/ee/license-check/lib/utils";
import { EmailCustomizationSettings } from "@/modules/ee/whitelabel/email-customization/components/email-customization-settings";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { IdBadge } from "@/modules/ui/components/id-badge";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import packageJson from "@/package.json";
import { SettingsCard } from "../../components/SettingsCard";
import { AISettingsToggle } from "./components/AISettingsToggle";
import { DeleteOrganization } from "./components/DeleteOrganization";
import { EditOrganizationNameForm } from "./components/EditOrganizationNameForm";
import { SecurityListTip } from "./components/SecurityListTip";

const Page = async (props: { params: Promise<{ workspaceId: string }> }) => {
  const params = await props.params;
  const t = await getTranslate();

  const { session, currentUserMembership, organization, isOwner, isManager } = await getWorkspaceAuth(
    params.workspaceId
  );

  const user = session?.user?.id ? await getUser(session.user.id) : null;

  const isMultiOrgEnabled = await getIsMultiOrgEnabled();
  const hasWhiteLabelPermission = await getWhiteLabelPermission(organization.id);

  const isDeleteDisabled = !isOwner || !isMultiOrgEnabled;
  const currentUserRole = currentUserMembership?.role;

  const isOwnerOrManager = isManager || isOwner;

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("workspace.settings.general.organization_settings")}>
        <OrganizationSettingsNavbar
          isFormbricksCloud={IS_FORMBRICKS_CLOUD}
          membershipRole={currentUserMembership?.role}
          activeId="general"
        />
      </PageHeader>
      {!IS_STORAGE_CONFIGURED && (
        <div className="max-w-4xl">
          <Alert variant="warning">
            <AlertDescription>{t("common.storage_not_configured")}</AlertDescription>
          </Alert>
        </div>
      )}
      {!IS_FORMBRICKS_CLOUD && <SecurityListTip />}
      <SettingsCard
        title={t("workspace.settings.general.organization_name")}
        description={t("workspace.settings.general.organization_name_description")}>
        <EditOrganizationNameForm organization={organization} membershipRole={currentUserMembership?.role} />
      </SettingsCard>
      <SettingsCard
        title={t("environments.settings.general.ai_enabled")}
        description={t("environments.settings.general.ai_enabled_description")}>
        <AISettingsToggle
          organization={organization}
          membershipRole={currentUserMembership?.role}
          isInstanceAIConfigured={isInstanceAIConfigured()}
        />
      </SettingsCard>
      <EmailCustomizationSettings
        organization={organization}
        hasWhiteLabelPermission={hasWhiteLabelPermission}
        workspaceId={params.workspaceId}
        isReadOnly={!isOwnerOrManager}
        isFormbricksCloud={IS_FORMBRICKS_CLOUD}
        fbLogoUrl={FB_LOGO_URL}
        user={user}
        isStorageConfigured={IS_STORAGE_CONFIGURED}
      />
      {isMultiOrgEnabled && (
        <SettingsCard
          title={t("workspace.settings.general.delete_organization")}
          description={t("workspace.settings.general.delete_organization_description")}>
          <DeleteOrganization
            organization={organization}
            isDeleteDisabled={isDeleteDisabled}
            isUserOwner={currentUserRole === "owner"}
          />
        </SettingsCard>
      )}

      <div className="space-y-2">
        <IdBadge id={organization.id} label={t("common.organization_id")} variant="column" />
        <IdBadge id={packageJson.version} label={t("common.formbricks_version")} variant="column" />
      </div>
    </PageContentWrapper>
  );
};

export default Page;
