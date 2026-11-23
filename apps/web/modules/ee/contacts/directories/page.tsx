import { can } from "@/lib/authorization";
import { withAuthorizationSurface } from "@/lib/authorization/context";
import { ENTERPRISE_LICENSE_REQUEST_FORM_URL, IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getTranslate } from "@/lingodotdev/server";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { getOrganizationAuth } from "@/modules/organization/lib/utils";
import { redirectBillingRoleFromRestrictedOrgSettings } from "@/modules/settings/lib/redirect-billing-role";
import { getOrganizationBillingPath } from "@/modules/settings/lib/routes";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";
import { ContactDirectoriesView } from "./components/contact-directories-view";
import { ContactDirectoriesQueryClientProvider } from "./components/query-client-provider";

/**
 * Organization settings › Contact directories (ENG-7497). Only the auth and licence checks run here; the
 * list itself comes from `/api/internal/contact-directories` through TanStack Query.
 */
export const ContactDirectoriesPage = async (props: {
  readonly params: Promise<{ organizationId: string }>;
}) => {
  const params = await props.params;
  const t = await getTranslate();

  await redirectBillingRoleFromRestrictedOrgSettings(params.organizationId);

  const { organization, session } = await getOrganizationAuth(params.organizationId);

  const [canManageOrganization, isContactsEnabled] = await Promise.all([
    withAuthorizationSurface("page", () =>
      can({ type: "user", id: session.user.id }, "organization.manage", {
        type: "organization",
        id: organization.id,
      })
    ),
    getIsContactsEnabled(organization.id),
  ]);

  const pageTitle = t("workspace.settings.contact_directories.title");

  // An unlicensed organization sees the upgrade prompt before the role check, as Feedback Datasets does.
  if (!isContactsEnabled) {
    const billingPath = getOrganizationBillingPath(params.organizationId, IS_FORMBRICKS_CLOUD);
    return (
      <PageContentWrapper>
        <PageHeader pageTitle={pageTitle} />
        <div className="flex items-center justify-center">
          <UpgradePrompt
            title={t("workspace.contacts.unlock_contacts_title")}
            description={t("workspace.contacts.unlock_contacts_description")}
            feature="contacts"
            buttons={[
              {
                text: IS_FORMBRICKS_CLOUD ? t("common.upgrade_plan") : t("common.request_trial_license"),
                href: IS_FORMBRICKS_CLOUD ? billingPath : ENTERPRISE_LICENSE_REQUEST_FORM_URL,
              },
              {
                text: t("common.learn_more"),
                href: IS_FORMBRICKS_CLOUD
                  ? billingPath
                  : "https://formbricks.com/learn-more-self-hosting-license?utm_source=formbricks-app&utm_medium=webapp&utm_campaign=ee_lock_contacts",
              },
            ]}
          />
        </div>
      </PageContentWrapper>
    );
  }

  if (!canManageOrganization) {
    return (
      <PageContentWrapper>
        <PageHeader pageTitle={pageTitle} />
        <p className="text-sm text-slate-500">{t("workspace.settings.contact_directories.no_access")}</p>
      </PageContentWrapper>
    );
  }

  return (
    <ContactDirectoriesQueryClientProvider>
      <ContactDirectoriesView organizationId={organization.id} />
    </ContactDirectoriesQueryClientProvider>
  );
};
