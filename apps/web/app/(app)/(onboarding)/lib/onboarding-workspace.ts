import "server-only";
import { AuthorizationError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TOrganization } from "@formbricks/types/organizations";
import { TWorkspace } from "@formbricks/types/workspace";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessFlags } from "@/lib/membership/utils";
import { getOrganization, updateOrganization } from "@/lib/organization/service";
import { getUserWorkspaces, getWorkspaces } from "@/lib/workspace/service";
import { getIsAISmartToolsEnabled } from "@/modules/ee/license-check/lib/utils";

export const selectOldestWorkspace = (workspaces: TWorkspace[]): TWorkspace | undefined => {
  if (workspaces.length === 0) {
    return undefined;
  }

  return [...workspaces].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())[0];
};

const assertCanManageOnboardingWorkspace = async (userId: string, organizationId: string): Promise<void> => {
  const membership = await getMembershipByUserIdOrganizationId(userId, organizationId);
  const { isOwner, isManager } = getAccessFlags(membership?.role);

  if (!isOwner && !isManager) {
    throw new AuthorizationError("User is not authorized to create a workspace in this organization");
  }
};

const ensureOrganizationAISmartTools = async (
  organizationId: string
): Promise<{ organization: TOrganization; isEntitled: boolean }> => {
  let organization = await getOrganization(organizationId);

  if (!organization) {
    throw new ResourceNotFoundError("Organization", organizationId);
  }

  const isEntitled = await getIsAISmartToolsEnabled(organizationId);

  if (isEntitled && !organization.isAISmartToolsEnabled) {
    organization = await updateOrganization(organizationId, { isAISmartToolsEnabled: true });
  }

  return { organization, isEntitled };
};

export const getOnboardingWorkspace = async (
  userId: string,
  organizationId: string
): Promise<TWorkspace | undefined> => {
  const userWorkspaces = await getUserWorkspaces(userId, organizationId);
  const userWorkspace = selectOldestWorkspace(userWorkspaces);

  if (userWorkspace) {
    return userWorkspace;
  }

  const organizationWorkspaces = await getWorkspaces(organizationId);
  return selectOldestWorkspace(organizationWorkspaces);
};

export type TOnboardingWorkspaceContext = {
  workspace: TWorkspace;
  isAISmartToolsEnabled: boolean;
  isAISmartToolsEntitled: boolean;
};

export const getOnboardingWorkspaceContext = async ({
  userId,
  organizationId,
}: {
  userId: string;
  organizationId: string;
}): Promise<TOnboardingWorkspaceContext> => {
  await assertCanManageOnboardingWorkspace(userId, organizationId);

  const { organization, isEntitled } = await ensureOrganizationAISmartTools(organizationId);
  const workspace = await getOnboardingWorkspace(userId, organizationId);

  if (!workspace) {
    throw new ResourceNotFoundError("Workspace", organizationId);
  }

  return {
    workspace,
    isAISmartToolsEnabled: organization.isAISmartToolsEnabled,
    isAISmartToolsEntitled: isEntitled,
  };
};
