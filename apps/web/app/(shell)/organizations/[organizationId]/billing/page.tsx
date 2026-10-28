import { can } from "@/lib/authorization";
import { withAuthorizationSurface } from "@/lib/authorization/context";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getReportingTimeZone } from "@/lib/date-ranges";
import { getMonthlyOrganizationResponseCount } from "@/lib/organization/service";
import { getOrganizationWorkspacesCount } from "@/lib/workspace/service";
import { getLocale } from "@/lingodotdev/language";
import { getTranslate } from "@/lingodotdev/server";
import { getCloudBillingDisplayContext } from "@/modules/ee/billing/lib/cloud-billing-display";
import { GRACE_PERIOD_MS, getEnterpriseLicense } from "@/modules/ee/license-check/lib/license";
import {
  ENTERPRISE_LICENSE_REQUEST_FORM_URL,
  getLiteLicenseRequestUrl,
} from "@/modules/ee/license-check/lib/lite-license";
import { getOrganizationWorkspacesLimit } from "@/modules/ee/license-check/lib/utils";
import { resolveUsageRange } from "@/modules/organization/usage/lib/range";
import { getOrganizationUsage } from "@/modules/organization/usage/lib/usage";
import { OrganizationHeader } from "@/modules/shell/components/organization-header";
import { ShellPage } from "@/modules/shell/components/shell-page";
import { getShellData } from "@/modules/shell/lib/shell-data";
import { CloudBilling } from "@/modules/shell/organization/components/cloud-billing";
import { LicenseOverview } from "@/modules/shell/organization/components/license-overview";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";

/**
 * Billing for everyone, including the billing role. One route, two pages: on Cloud the subscription and
 * its usage, self-hosted the license and what it unlocks. A plain member sees Cloud usage read-only and
 * nothing of the license.
 */
const BillingPage = async ({ params }: Readonly<{ params: Promise<{ organizationId: string }> }>) => {
  const { organizationId } = await params;
  const shell = await getShellData(organizationId);
  const [t, locale] = await Promise.all([getTranslate(), getLocale()]);

  // Owner, manager and billing; a member has the role but not this capability.
  const canManageBilling = await withAuthorizationSurface("page", () =>
    can({ type: "user", id: shell.user.id }, "organization.manage_billing", {
      type: "organization",
      id: organizationId,
    })
  );

  const renderBody = async () => {
    if (IS_FORMBRICKS_CLOUD) {
      const [billing, responseCount, workspaceCount] = await Promise.all([
        getCloudBillingDisplayContext(organizationId),
        getMonthlyOrganizationResponseCount(organizationId),
        getOrganizationWorkspacesCount(organizationId),
      ]);

      return (
        <CloudBilling
          organizationId={organizationId}
          billing={billing}
          responseCount={responseCount}
          workspaceCount={workspaceCount}
          canManageBilling={canManageBilling}
          locale={locale}
        />
      );
    }

    if (!canManageBilling) {
      return (
        <Alert variant="info" role="status">
          <AlertDescription>{t("shell.organization.billing.license_restricted")}</AlertDescription>
        </Alert>
      );
    }

    const timeZone = getReportingTimeZone(shell.organization.displayTimeZone);
    const [license, usage, workspaceLimit] = await Promise.all([
      getEnterpriseLicense(),
      getOrganizationUsage({
        organizationId,
        range: resolveUsageRange({ preset: "this_year" }, timeZone),
        timeZone,
      }),
      getOrganizationWorkspacesLimit(organizationId),
    ]);

    return (
      <LicenseOverview
        status={license.status}
        lastChecked={license.lastChecked}
        gracePeriodEnd={
          license.status === "unreachable" ? new Date(license.lastChecked.getTime() + GRACE_PERIOD_MS) : null
        }
        features={license.features}
        usage={{
          members: usage.members.total,
          workspaces: usage.workspaces.length,
          workspaceLimit: Number.isFinite(workspaceLimit) ? workspaceLimit : null,
          responsesThisYear: usage.totals.responseCount,
        }}
        recheckWorkspaceId={usage.workspaces[0]?.id ?? null}
        trialRequestUrl={ENTERPRISE_LICENSE_REQUEST_FORM_URL}
        liteRequestUrl={getLiteLicenseRequestUrl("enterprise_settings")}
        locale={locale}
      />
    );
  };

  return (
    <ShellPage>
      <div className="overflow-x-auto">
        <OrganizationHeader organizationId={organizationId} activeId="billing" isBilling={shell.isBilling} />
      </div>
      {await renderBody()}
    </ShellPage>
  );
};

export default BillingPage;
