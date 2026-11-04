import { redirect } from "next/navigation";
import type { Session } from "@formbricks/types/auth";
import { getOnboardingWorkspace } from "@/app/(app)/(onboarding)/lib/onboarding-workspace";
import { getOnboardingRedirectPath } from "@/app/(app)/(onboarding)/lib/redirect-if-onboarding-complete";
import ClientWorkspaceRedirect from "@/app/ClientWorkspaceRedirect";
import { getIsFreshInstance } from "@/lib/instance/service";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessFlags } from "@/lib/membership/utils";
import { getOrganizationsByUserId } from "@/lib/organization/service";
import { getUser } from "@/lib/user/service";
import { getUserWorkspaces } from "@/lib/workspace/service";
import { getSession } from "@/modules/auth/lib/session";
import {
  getDashboardViewerUnavailablePath,
  listDashboardViewerOrganizations,
  listDashboardViewerWorkspacesForUser,
} from "@/modules/ee/analysis/lib/dashboard-viewer-access";
import { ClientLogout } from "@/modules/ui/components/client-logout";

/**
 * Every workspace the user can open, across their organizations: the ones their role reaches, and — when
 * they are a Dashboard viewer anywhere — the ones their teams are granted, in one lookup.
 */
const collectWorkspaceIds = async (
  userId: string,
  organizationIds: readonly string[],
  isDashboardViewer: boolean
): Promise<string[]> => {
  const ids: string[] = [];
  for (const organizationId of organizationIds) {
    for (const workspace of await getUserWorkspaces(userId, organizationId)) ids.push(workspace.id);
  }
  if (isDashboardViewer) {
    for (const workspace of await listDashboardViewerWorkspacesForUser(userId)) ids.push(workspace.id);
  }
  return ids;
};

const Page = async () => {
  const session: Session | null = await getSession();
  const isFreshInstance = await getIsFreshInstance();

  if (!session) {
    return redirect(isFreshInstance ? "/setup/intro" : "/auth/login");
  }

  const user = await getUser(session.user.id);
  if (!user) {
    return <ClientLogout />;
  }

  // A Dashboard viewer has no `organization.read` (ADR-0025), so its organizations come from its
  // memberships; its workspaces are the ones its teams are granted.
  const [userOrganizations, viewerOrganizations] = await Promise.all([
    getOrganizationsByUserId(session.user.id),
    listDashboardViewerOrganizations(session.user.id),
  ]);

  if (userOrganizations.length === 0 && viewerOrganizations.length === 0) {
    return redirect("/setup/organization/create");
  }

  const allWorkspaceIds = await collectWorkspaceIds(
    user.id,
    userOrganizations.map((organization) => organization.id),
    viewerOrganizations.length > 0
  );

  if (userOrganizations.length === 0) {
    // Only a Dashboard viewer: the last-used granted workspace's dashboards (the workspace page sends a
    // viewer there), or the page explaining why there are none.
    return allWorkspaceIds.length === 0 ? (
      redirect(getDashboardViewerUnavailablePath(viewerOrganizations[0].id))
    ) : (
      <ClientWorkspaceRedirect userWorkspaceIds={allWorkspaceIds} />
    );
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(
    session.user.id,
    userOrganizations[0].id
  );

  const { isManager, isOwner } = getAccessFlags(currentUserMembership?.role);

  if (isOwner || isManager) {
    const onboardingWorkspace = await getOnboardingWorkspace(session.user.id, userOrganizations[0].id);
    const onboardingRedirectPath = await getOnboardingRedirectPath({
      organizationId: userOrganizations[0].id,
      workspace: onboardingWorkspace,
    });

    if (onboardingRedirectPath) {
      return redirect(onboardingRedirectPath);
    }
  }

  if (allWorkspaceIds.length === 0) {
    return redirect(`/organizations/${userOrganizations[0].id}/landing`);
  }

  return <ClientWorkspaceRedirect userWorkspaceIds={allWorkspaceIds} />;
};

export default Page;
