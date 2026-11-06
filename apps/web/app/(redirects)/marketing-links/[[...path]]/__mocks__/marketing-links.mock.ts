import type { getOrganizationsByUserId } from "@/app/(app)/workspaces/[workspaceId]/lib/organization";
import type { getWorkspacesByUserId } from "@/app/(app)/workspaces/[workspaceId]/lib/workspace";

type TOrganization = Awaited<ReturnType<typeof getOrganizationsByUserId>>[number];
type TWorkspace = Awaited<ReturnType<typeof getWorkspacesByUserId>>[number];

/** What the mocked cookies and data layer return; tests reset and adjust it per case. */
export const marketingLinksData = {
  cookies: {} as Record<string, string>,
  organizations: [] as Pick<TOrganization, "id">[],
  workspaces: [] as TWorkspace[],
  /** workspace id -> organization id, for `getWorkspace` */
  workspaceOrganization: {} as Record<string, string>,
  role: "owner",
};

export const mockCookiesModule = () => ({
  cookies: () => Promise.resolve({ get: (name: string) => ({ value: marketingLinksData.cookies[name] }) }),
});

export const mockOrganizationModule = () => ({
  getOrganizationsByUserId: () => Promise.resolve(marketingLinksData.organizations),
});

export const mockWorkspaceModule = () => ({
  getWorkspacesByUserId: () => Promise.resolve(marketingLinksData.workspaces),
});

export const mockWorkspaceServiceModule = () => ({
  getWorkspace: (id: string) => {
    const organizationId = marketingLinksData.workspaceOrganization[id];
    return Promise.resolve(organizationId ? { id, organizationId } : null);
  },
});

export const mockMembershipServiceModule = () => ({
  getMembershipByUserIdOrganizationId: () => Promise.resolve({ role: marketingLinksData.role }),
});
