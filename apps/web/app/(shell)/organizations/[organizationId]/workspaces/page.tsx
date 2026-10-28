import { getReportingTimeZone } from "@/lib/date-ranges";
import { getOrganizationWorkspacesCount } from "@/lib/workspace/service";
import { getLocale } from "@/lingodotdev/language";
import { getTranslate } from "@/lingodotdev/server";
import { getOrganizationWorkspacesLimit } from "@/modules/ee/license-check/lib/utils";
import { OrganizationHeader } from "@/modules/shell/components/organization-header";
import { ShellPage } from "@/modules/shell/components/shell-page";
import { CreateWorkspaceDialog } from "@/modules/shell/organization/components/create-workspace-dialog";
import { SectionHeading } from "@/modules/shell/organization/components/section-heading";
import { WorkspacesTable } from "@/modules/shell/organization/components/workspaces-table";
import { requireNonBillingRole } from "@/modules/shell/organization/lib/restricted-section";
import { getWorkspaceDirectory } from "@/modules/shell/organization/lib/workspace-directory";
import { Alert, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";

const WorkspacesPage = async ({ params }: Readonly<{ params: Promise<{ organizationId: string }> }>) => {
  const { organizationId } = await params;
  const shell = await requireNonBillingRole(organizationId);
  const [t, locale] = await Promise.all([getTranslate(), getLocale()]);

  const isOwnerOrManager = shell.isOwner || shell.isManager;

  const [workspaces, workspaceLimit, workspaceCount] = await Promise.all([
    getWorkspaceDirectory({ organizationId, viewerId: shell.user.id, canSeeAll: isOwnerOrManager }),
    isOwnerOrManager ? getOrganizationWorkspacesLimit(organizationId) : Promise.resolve(Infinity),
    isOwnerOrManager ? getOrganizationWorkspacesCount(organizationId) : Promise.resolve(0),
  ]);
  const isLimitReached = workspaceCount >= workspaceLimit;

  return (
    <ShellPage>
      <div className="overflow-x-auto">
        <OrganizationHeader
          organizationId={organizationId}
          activeId="workspaces"
          isBilling={shell.isBilling}
        />
      </div>

      <SectionHeading
        title={t("common.workspaces")}
        description={t("shell.organization.workspaces.description")}
        cta={
          isOwnerOrManager ? (
            <CreateWorkspaceDialog organizationId={organizationId} isLimitReached={isLimitReached} />
          ) : undefined
        }
      />

      {isLimitReached && (
        <Alert variant="warning" role="status">
          <AlertDescription>{t("shell.organization.workspaces.limit_reached")}</AlertDescription>
        </Alert>
      )}

      {workspaces.length > 0 ? (
        <WorkspacesTable
          workspaces={workspaces}
          canManage={isOwnerOrManager}
          locale={locale}
          timeZone={getReportingTimeZone(shell.organization.displayTimeZone)}
        />
      ) : (
        <p className="rounded-xl border border-slate-200 p-6 text-center text-slate-500">
          {t("shell.organization.workspaces.empty")}
        </p>
      )}

      <Alert variant="info" role="status">
        <AlertTitle>{t("shell.organization.workspaces.agent_note_title")}</AlertTitle>
        <AlertDescription>{t("shell.organization.workspaces.agent_note_description")}</AlertDescription>
      </Alert>
    </ShellPage>
  );
};

export default WorkspacesPage;
