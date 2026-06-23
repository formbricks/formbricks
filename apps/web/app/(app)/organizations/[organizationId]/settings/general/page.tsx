import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import { AISettingsToggle } from "@/app/(app)/workspaces/[workspaceId]/settings/organization/general/components/AISettingsToggle";
import { CreateOrganizationCard } from "@/app/(app)/workspaces/[workspaceId]/settings/organization/general/components/CreateOrganizationCard";
import { DeleteOrganization } from "@/app/(app)/workspaces/[workspaceId]/settings/organization/general/components/DeleteOrganization";
import { EditOrganizationNameForm } from "@/app/(app)/workspaces/[workspaceId]/settings/organization/general/components/EditOrganizationNameForm";
import { SecurityListTip } from "@/app/(app)/workspaces/[workspaceId]/settings/organization/general/components/SecurityListTip";
import { isInstanceAIConfigured } from "@/lib/ai/service";
import {
  ENTERPRISE_LICENSE_REQUEST_FORM_URL,
  FB_LOGO_URL,
  IS_FORMBRICKS_CLOUD,
  IS_STORAGE_CONFIGURED,
} from "@/lib/constants";
import { getUser } from "@/lib/user/service";
import { getTranslate } from "@/lingodotdev/server";
import {
  getIsAISmartToolsEnabled,
  getIsMultiOrgEnabled,
  getWhiteLabelPermission,
} from "@/modules/ee/license-check/lib/utils";
import { EmailCustomizationSettings } from "@/modules/ee/whitelabel/email-customization/components/email-customization-settings";
import { getOrganizationAuth } from "@/modules/organization/lib/utils";
import { getSettingsLayoutData } from "@/modules/settings/lib/navigation-data";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { IdBadge } from "@/modules/ui/components/id-badge";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import packageJson from "@/package.json";

const Page = async (props: Readonly<{ params: Promise<{ organizationId: string }> }>) => {
  const params = await props.params;
  const t = await getTranslate();

  const { session, currentUserMembership, organization, isOwner, isManager } = await getOrganizationAuth(
    params.organizationId
  );

  const user = session?.user?.id ? await getUser(session.user.id) : null;

  const [isMultiOrgEnabled, hasWhiteLabelPermission, hasAIPermission, layoutData] = await Promise.all([
    getIsMultiOrgEnabled(),
    getWhiteLabelPermission(organization.id),
    getIsAISmartToolsEnabled(organization.id),
    getSettingsLayoutData(session.user.id, organization.id),
  ]);

  const isDeleteDisabled = !isOwner || !isMultiOrgEnabled;
  const currentUserRole = currentUserMembership?.role;
  const isOwnerOrManager = isManager || isOwner;

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("workspace.settings.general.organization_settings")} />
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
        <EditOrganizationNameForm organization={organization} membershipRole={currentUserRole} />
      </SettingsCard>
      <SettingsCard
        title={t("workspace.settings.general.ai_enabled")}
        description={t("workspace.settings.general.ai_enabled_description")}>
        <AISettingsToggle
          organization={organization}
          membershipRole={currentUserRole}
          isInstanceAIConfigured={isInstanceAIConfigured()}
          hasAIPermission={hasAIPermission}
          isFormbricksCloud={IS_FORMBRICKS_CLOUD}
          enterpriseLicenseRequestFormUrl={ENTERPRISE_LICENSE_REQUEST_FORM_URL}
        />
      </SettingsCard>
      <EmailCustomizationSettings
        organization={organization}
        hasWhiteLabelPermission={hasWhiteLabelPermission}
        workspaceId={layoutData?.currentWorkspace?.id ?? ""}
        isReadOnly={!isOwnerOrManager}
        isFormbricksCloud={IS_FORMBRICKS_CLOUD}
        fbLogoUrl={FB_LOGO_URL}
        user={user}
        isStorageConfigured={IS_STORAGE_CONFIGURED}
        enterpriseLicenseRequestFormUrl={ENTERPRISE_LICENSE_REQUEST_FORM_URL}
      />
      {isMultiOrgEnabled && (
        <>
          <SettingsCard
            title={t("workspace.settings.general.delete_organization")}
            description={t("workspace.settings.general.delete_organization_description")}>
            <DeleteOrganization
              organization={organization}
              isDeleteDisabled={isDeleteDisabled}
              isUserOwner={currentUserRole === "owner"}
            />
          </SettingsCard>
          <CreateOrganizationCard />
        </>
      )}

      <div className="space-y-2">
        <IdBadge id={organization.id} label={t("common.organization_id")} variant="column" />
        <IdBadge id={packageJson.version} label={t("common.formbricks_version")} variant="column" />
      </div>
    </PageContentWrapper>
  );
};

export default Page;
