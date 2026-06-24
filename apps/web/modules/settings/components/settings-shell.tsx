import { TopControlBar } from "@/app/(app)/workspaces/[workspaceId]/components/TopControlBar";
import { WorkspaceContextWrapper } from "@/app/(app)/workspaces/[workspaceId]/context/workspace-context";
import { SettingsNavigation } from "@/modules/settings/components/settings-navigation";
import type { TSettingsLayoutData } from "@/modules/settings/lib/navigation-data";
import { LimitsReachedBanner } from "@/modules/ui/components/limits-reached-banner";
import { PendingDowngradeBanner } from "@/modules/ui/components/pending-downgrade-banner";

interface SettingsShellProps {
  data: TSettingsLayoutData;
  children: React.ReactNode;
}

// Reproduces the workspace shell (banners + sidebar + top bar) used on every settings page, so the
// org-scoped and account-scoped settings routes look identical to the in-workspace settings view —
// only the sidebar comes from SettingsNavigation instead of MainNavigation. The WorkspaceContext is
// supplied from the current workspace so reused settings components (which call useWorkspace) behave
// exactly as they do inside the workspace layout.
export const SettingsShell = ({ data, children }: Readonly<SettingsShellProps>) => {
  const { lastChecked, isPendingDowngrade, active, status } = data.license;
  const organization = {
    ...data.organization,
    billing: {
      ...data.organization.billing,
      stripe: data.organization.billing.stripe ?? undefined,
    },
  };

  const shell = (
    <div className="flex h-screen min-h-screen flex-col overflow-hidden">
      {data.isFormbricksCloud && (
        <LimitsReachedBanner organization={organization} responseCount={data.responseCount} />
      )}

      <PendingDowngradeBanner
        lastChecked={lastChecked}
        isPendingDowngrade={isPendingDowngrade ?? false}
        active={active}
        locale={data.user.locale}
        status={status}
      />

      <div className="flex h-full">
        <SettingsNavigation
          user={data.user}
          workspaceId={data.currentWorkspace?.id ?? ""}
          workspaceName={data.currentWorkspace?.name ?? ""}
          organizationId={data.organization.id}
          organizationName={data.organization.name}
          membershipRole={data.membershipRole}
          isFormbricksCloud={data.isFormbricksCloud}
          publicDomain={data.publicDomain}
          backUrl={data.backUrl}
        />
        <div id="mainContent" className="flex flex-1 flex-col overflow-hidden bg-slate-50">
          {/* TopControlBar reads the workspace context (and would throw without it), so it only renders
              when there is a current workspace — a user with no workspace still gets the org settings. */}
          {data.currentWorkspace && (
            <TopControlBar
              currentOrganizationId={data.organization.id}
              isMultiOrgEnabled={data.isMultiOrgEnabled}
              organizationWorkspacesLimit={data.organizationWorkspacesLimit}
              isFormbricksCloud={data.isFormbricksCloud}
              isLicenseActive={active}
              isOwnerOrManager={data.isOwnerOrManager}
              isAccessControlAllowed={data.isAccessControlAllowed}
              membershipRole={data.membershipRole}
            />
          )}
          <div className="flex-1 overflow-y-auto">{children}</div>
        </div>
      </div>
    </div>
  );

  // Reused settings components call useWorkspace(); provide the context from the current workspace so
  // they render identically. With no workspace yet, useWorkspace falls back to null on its own.
  if (data.currentWorkspace) {
    return (
      <WorkspaceContextWrapper workspace={data.currentWorkspace} organization={organization}>
        {shell}
      </WorkspaceContextWrapper>
    );
  }

  return shell;
};
