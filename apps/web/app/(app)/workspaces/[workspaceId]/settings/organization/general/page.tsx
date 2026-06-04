import { redirectBillingRoleFromRestrictedSettings } from "@/app/(app)/workspaces/[workspaceId]/settings/lib/redirect-billing-role";
import { isInstanceAIConfigured } from "@/lib/ai/service";
import {
  ENTERPRISE_LICENSE_REQUEST_FORM_URL,
  FB_LOGO_URL,
  IS_FORMBRICKS_CLOUD,
  IS_STORAGE_CONFIGURED,
} from "@/lib/constants";
import { getUser } from "@/lib/user/service";
import { getTranslate } from "@/lingodotdev/server";
import { getEnterpriseLicense } from "@/modules/ee/license-check/lib/license";
import {
  getIsAISmartToolsEnabled,
  getIsMultiOrgEnabled,
  getWhiteLabelPermission,
} from "@/modules/ee/license-check/lib/utils";
import { EmailCustomizationSettings } from "@/modules/ee/whitelabel/email-customization/components/email-customization-settings";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { IdBadge } from "@/modules/ui/components/id-badge";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import packageJson from "@/package.json";
import { SettingsCard } from "../../components/SettingsCard";
import { AISettingsToggle } from "./components/AISettingsToggle";
import { CreateOrganizationCard } from "./components/CreateOrganizationCard";
import { DeleteOrganization } from "./components/DeleteOrganization";
import { EditOrganizationNameForm } from "./components/EditOrganizationNameForm";
import { SecurityListTip } from "./components/SecurityListTip";
import { SsoLicenseTip } from "./components/SsoLicenseTip";

const Page = async (props: Readonly<{ params: Promise<{ workspaceId: string }> }>) => {
  const params = await props.params;
  await redirectBillingRoleFromRestrictedSettings(params.workspaceId);
  const t = await getTranslate();

  const { session, currentUserMembership, organization, isOwner, isManager } = await getWorkspaceAuth(
    params.workspaceId
  );

  const user = session?.user?.id ? await getUser(session.user.id) : null;

  const [isMultiOrgEnabled, hasWhiteLabelPermission, hasAIPermission, enterpriseLicense] = await Promise.all([
    getIsMultiOrgEnabled(),
    getWhiteLabelPermission(organization.id),
    getIsAISmartToolsEnabled(organization.id),
    IS_FORMBRICKS_CLOUD ? Promise.resolve(null) : getEnterpriseLicense(),
  ]);

  const isDeleteDisabled = !isOwner || !isMultiOrgEnabled;
  const currentUserRole = currentUserMembership?.role;

  const isOwnerOrManager = isManager || isOwner;
  const showSsoLicenseTip =
    !IS_FORMBRICKS_CLOUD && isOwnerOrManager && enterpriseLicense?.status === "no-license" && !!user?.email;

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
      {showSsoLicenseTip && user?.email && (
        <SsoLicenseTip userEmail={user.email} licenseRequestUrl={ENTERPRISE_LICENSE_REQUEST_FORM_URL} />
      )}
      <SettingsCard
        title={t("workspace.settings.general.organization_name")}
        description={t("workspace.settings.general.organization_name_description")}>
        <EditOrganizationNameForm organization={organization} membershipRole={currentUserMembership?.role} />
      </SettingsCard>
      <SettingsCard
        title={t("workspace.settings.general.ai_enabled")}
        description={t("workspace.settings.general.ai_enabled_description")}>
        <AISettingsToggle
          organization={organization}
          membershipRole={currentUserMembership?.role}
          isInstanceAIConfigured={isInstanceAIConfigured()}
          hasAIPermission={hasAIPermission}
          isFormbricksCloud={IS_FORMBRICKS_CLOUD}
          enterpriseLicenseRequestFormUrl={ENTERPRISE_LICENSE_REQUEST_FORM_URL}
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
