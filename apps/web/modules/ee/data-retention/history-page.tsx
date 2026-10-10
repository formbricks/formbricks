import { can } from "@/lib/authorization";
import { withAuthorizationSurface } from "@/lib/authorization/context";
import { getReportingTimeZone } from "@/lib/date-ranges";
import { getTranslate } from "@/lingodotdev/server";
import { getOrganizationAuth } from "@/modules/organization/lib/utils";
import { RetentionHistoryView } from "./components/history/retention-history-view";

/**
 * The History tab. Owners and managers only, because run items name the people who were notified or
 * deactivated; the layout has already checked the entitlement. The API checks both again.
 */
export const DataRetentionHistoryPage = async ({
  params,
}: Readonly<{ params: Promise<{ organizationId: string }> }>) => {
  const { organizationId } = await params;
  const [t, { organization, session }] = await Promise.all([
    getTranslate(),
    getOrganizationAuth(organizationId),
  ]);

  const canManage = await withAuthorizationSurface("page", () =>
    can({ type: "user", id: session.user.id }, "organization.manage", {
      type: "organization",
      id: organization.id,
    })
  );

  if (!canManage) {
    return (
      <p className="text-sm text-slate-500">{t("workspace.settings.data_retention.history_no_access")}</p>
    );
  }

  return (
    <RetentionHistoryView
      organizationId={organization.id}
      timeZone={getReportingTimeZone(organization.displayTimeZone)}
    />
  );
};
