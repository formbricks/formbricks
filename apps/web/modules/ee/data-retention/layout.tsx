import type { ReactNode } from "react";
import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import { can } from "@/lib/authorization";
import { withAuthorizationSurface } from "@/lib/authorization/context";
import { ENTERPRISE_LICENSE_REQUEST_FORM_URL, IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getReportingTimeZone } from "@/lib/date-ranges";
import { getTranslate } from "@/lingodotdev/server";
import { getIsDataRetentionEnabled } from "@/modules/ee/license-check/lib/utils";
import { getOrganizationAuth } from "@/modules/organization/lib/utils";
import { redirectBillingRoleFromRestrictedOrgSettings } from "@/modules/settings/lib/redirect-billing-role";
import { getOrganizationBillingPath } from "@/modules/settings/lib/routes";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";
import { DataRetentionSecondaryNavigation } from "./components/data-retention-secondary-navigation";
import { RetentionHealthAlerts } from "./components/health/retention-health-alerts";
import { DataRetentionQueryClientProvider } from "./components/query-client-provider";

/**
 * The Data retention settings page around its tabs. An organization without the entitlement sees the
 * upgrade prompt and no tabs: the tabs' API routes would only answer 403 (ENG-3695).
 */
export const DataRetentionLayout = async ({
  params,
  children,
}: Readonly<{ params: Promise<{ organizationId: string }>; children: ReactNode }>) => {
  const { organizationId } = await params;
  const t = await getTranslate();

  await redirectBillingRoleFromRestrictedOrgSettings(organizationId);

  const { organization, session } = await getOrganizationAuth(organizationId);
  const [canManage, isDataRetentionEnabled] = await Promise.all([
    withAuthorizationSurface("page", () =>
      can({ type: "user", id: session.user.id }, "organization.manage", {
        type: "organization",
        id: organization.id,
      })
    ),
    getIsDataRetentionEnabled(organization.id),
  ]);

  const pageTitle = t("workspace.settings.data_retention.title");

  if (!isDataRetentionEnabled) {
    return (
      <PageContentWrapper>
        <PageHeader pageTitle={pageTitle} />
        <SettingsCard
          title={t("workspace.settings.data_retention.title")}
          description={t("workspace.settings.data_retention.description")}>
          <UpgradePrompt
            title={t("workspace.settings.data_retention.upgrade_prompt_title")}
            description={t("workspace.settings.data_retention.upgrade_prompt_description")}
            feature="data-retention"
            buttons={[
              {
                text: IS_FORMBRICKS_CLOUD ? t("common.upgrade_plan") : t("common.request_trial_license"),
                href: IS_FORMBRICKS_CLOUD
                  ? getOrganizationBillingPath(organization.id, IS_FORMBRICKS_CLOUD)
                  : ENTERPRISE_LICENSE_REQUEST_FORM_URL,
              },
              {
                text: t("common.learn_more"),
                href: IS_FORMBRICKS_CLOUD
                  ? getOrganizationBillingPath(organization.id, IS_FORMBRICKS_CLOUD)
                  : "https://formbricks.com/learn-more-self-hosting-license?utm_source=formbricks-app&utm_medium=webapp&utm_campaign=ee_lock_data_retention",
              },
            ]}
          />
        </SettingsCard>
      </PageContentWrapper>
    );
  }

  return (
    <DataRetentionQueryClientProvider>
      <PageContentWrapper>
        <PageHeader pageTitle={pageTitle}>
          <DataRetentionSecondaryNavigation organizationId={organization.id} canManage={canManage} />
        </PageHeader>
        {canManage ? (
          <RetentionHealthAlerts
            organizationId={organization.id}
            timeZone={getReportingTimeZone(organization.displayTimeZone)}
          />
        ) : null}
        {children}
      </PageContentWrapper>
    </DataRetentionQueryClientProvider>
  );
};
