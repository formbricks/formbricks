import { can } from "@/lib/authorization";
import { withAuthorizationSurface } from "@/lib/authorization/context";
import { getReportingTimeZone } from "@/lib/date-ranges";
import { getLocale } from "@/lingodotdev/language";
import { getIsAuditLogsEnabled, getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import { OrganizationHeader } from "@/modules/shell/components/organization-header";
import { ShellPage } from "@/modules/shell/components/shell-page";
import { AuditLogCard } from "@/modules/shell/organization/components/audit-log-card";
import { DeleteOrganizationCard } from "@/modules/shell/organization/components/delete-organization-card";
import { getRecentAuditEvents } from "@/modules/shell/organization/lib/audit-events";
import { requireNonBillingRole } from "@/modules/shell/organization/lib/restricted-section";

const SecurityPage = async ({ params }: Readonly<{ params: Promise<{ organizationId: string }> }>) => {
  const { organizationId } = await params;
  const shell = await requireNonBillingRole(organizationId);
  const locale = await getLocale();

  const [isAuditRecording, isMultiOrgEnabled, canReadAudit] = await Promise.all([
    getIsAuditLogsEnabled(),
    getIsMultiOrgEnabled(),
    // The same gate as the v3 audit-events operation: who administers the organization may read its trail.
    withAuthorizationSurface("page", () =>
      can({ type: "user", id: shell.user.id }, "organization.manage", {
        type: "organization",
        id: organizationId,
      })
    ),
  ]);

  const events = isAuditRecording && canReadAudit ? await getRecentAuditEvents(organizationId) : null;

  return (
    <ShellPage>
      <div className="overflow-x-auto">
        <OrganizationHeader organizationId={organizationId} activeId="security" isBilling={shell.isBilling} />
      </div>

      <AuditLogCard
        isRecording={isAuditRecording}
        events={events}
        locale={locale}
        timeZone={getReportingTimeZone(shell.organization.displayTimeZone)}
      />

      {shell.isOwner && (
        <DeleteOrganizationCard
          organization={{ id: shell.organization.id, name: shell.organization.name }}
          isDeletionAllowed={isMultiOrgEnabled}
        />
      )}
    </ShellPage>
  );
};

export default SecurityPage;
