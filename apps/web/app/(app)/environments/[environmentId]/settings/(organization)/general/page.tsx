import { OrganizationSettingsNavbar } from "@/app/(app)/environments/[environmentId]/settings/(organization)/components/OrganizationSettingsNavbar";
import { FB_LOGO_URL, IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getUser } from "@/lib/user/service";
import { getIsMultiOrgEnabled, getWhiteLabelPermission } from "@/modules/ee/license-check/lib/utils";
import { EmailCustomizationSettings } from "@/modules/ee/whitelabel/email-customization/components/email-customization-settings";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { IdBadge } from "@/modules/ui/components/id-badge";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";
import { SettingsCard } from "../../components/SettingsCard";
import { DeleteOrganization } from "./components/DeleteOrganization";
import { EditOrganizationNameForm } from "./components/EditOrganizationNameForm";

const Page = async (props: { params: Promise<{ environmentId: string }> }) => {
  const params = await props.params;
  const t = await getTranslate();

  const { session, currentUserMembership, organization, isOwner, isManager } = await getEnvironmentAuth(
    params.environmentId
  );

  const user = session?.user?.id ? await getUser(session.user.id) : null;

  const isMultiOrgEnabled = await getIsMultiOrgEnabled();
  const hasWhiteLabelPermission = await getWhiteLabelPermission(organization.billing.plan);

  const isDeleteDisabled = !isOwner || !isMultiOrgEnabled;
  const currentUserRole = currentUserMembership?.role;

  const isOwnerOrManager = isManager || isOwner;

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("environments.settings.general.organization_settings")}>
        <OrganizationSettingsNavbar
          environmentId={params.environmentId}
          isFormbricksCloud={IS_FORMBRICKS_CLOUD}
          membershipRole={currentUserMembership?.role}
          activeId="general"
        />
      </PageHeader>
      <SettingsCard
        title={t("environments.settings.general.organization_name")}
        description={t("environments.settings.general.organization_name_description")}>
        <EditOrganizationNameForm
          organization={organization}
          environmentId={params.environmentId}
          membershipRole={currentUserMembership?.role}
        />
      </SettingsCard>
      <EmailCustomizationSettings
        organization={organization}
        hasWhiteLabelPermission={hasWhiteLabelPermission}
        environmentId={params.environmentId}
        isReadOnly={!isOwnerOrManager}
        isFormbricksCloud={IS_FORMBRICKS_CLOUD}
        fbLogoUrl={FB_LOGO_URL}
        user={user}
      />
      {isMultiOrgEnabled && (
        <SettingsCard
          title={t("environments.settings.general.delete_organization")}
          description={t("environments.settings.general.delete_organization_description")}>
          <DeleteOrganization
            organization={organization}
            isDeleteDisabled={isDeleteDisabled}
            isUserOwner={currentUserRole === "owner"}
          />
        </SettingsCard>
      )}

      <IdBadge id={organization.id} label={t("common.organization_id")} variant="column" />
    </PageContentWrapper>
  );
};

export default Page;
