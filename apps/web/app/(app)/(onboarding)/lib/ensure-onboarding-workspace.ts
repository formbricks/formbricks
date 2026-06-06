import "server-only";
import { AuthorizationError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TOrganization } from "@formbricks/types/organizations";
import { TWorkspace } from "@formbricks/types/workspace";
import { DEFAULT_BRAND_COLOR } from "@/lib/constants";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessFlags } from "@/lib/membership/utils";
import { getOrganization, updateOrganization } from "@/lib/organization/service";
import { capturePostHogEvent, groupIdentifyPostHog } from "@/lib/posthog";
import { buildStylingFromBrandColor } from "@/lib/styling/constants";
import { getUserWorkspaces, getWorkspaces } from "@/lib/workspace/service";
import { getTranslate } from "@/lingodotdev/server";
import { getIsAISmartToolsEnabled } from "@/modules/ee/license-check/lib/utils";
import { createWorkspace } from "@/modules/workspaces/settings/lib/workspace";

const MAX_WORKSPACE_NAME_SUFFIX_ATTEMPTS = 100;

export const resolveUniqueWorkspaceName = (baseName: string, takenNames: Iterable<string>): string => {
  const taken = new Set(takenNames);

  if (!taken.has(baseName)) {
    return baseName;
  }

  for (let suffix = 2; suffix <= MAX_WORKSPACE_NAME_SUFFIX_ATTEMPTS; suffix++) {
    const candidate = `${baseName} ${suffix}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }

  throw new InvalidInputError(`Could not find a unique workspace name for "${baseName}"`);
};

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

const trackWorkspaceCreated = ({
  userId,
  organizationId,
  workspace,
}: {
  userId: string;
  organizationId: string;
  workspace: TWorkspace;
}): void => {
  groupIdentifyPostHog("workspace", workspace.id, { name: workspace.name });

  capturePostHogEvent(
    userId,
    "workspace_created",
    {
      organization_id: organizationId,
      workspace_id: workspace.id,
      name: workspace.name,
    },
    { organizationId, workspaceId: workspace.id }
  );
};

const createOnboardingWorkspace = async ({
  organizationId,
  organizationName,
  takenNames,
}: {
  organizationId: string;
  organizationName: string;
  takenNames: Iterable<string>;
}): Promise<TWorkspace> => {
  const t = await getTranslate();
  const fullStyling = buildStylingFromBrandColor(DEFAULT_BRAND_COLOR);
  const baseName = organizationName || t("common.my_product");
  const workspaceName = resolveUniqueWorkspaceName(baseName, takenNames);

  try {
    return await createWorkspace(organizationId, {
      name: workspaceName,
      styling: fullStyling,
      config: { channel: "link", industry: null },
    });
  } catch (error) {
    if (!(error instanceof InvalidInputError)) {
      throw error;
    }

    const latestOrganizationWorkspaces = await getWorkspaces(organizationId);
    const racedWorkspace = selectOldestWorkspace(latestOrganizationWorkspaces);

    if (racedWorkspace) {
      return racedWorkspace;
    }

    return createWorkspace(organizationId, {
      name: resolveUniqueWorkspaceName(baseName, [baseName]),
      styling: fullStyling,
      config: { channel: "link", industry: null },
    });
  }
};

export type TEnsureOnboardingWorkspaceResult = {
  workspace: TWorkspace;
  isAISmartToolsEnabled: boolean;
  isAISmartToolsEntitled: boolean;
};

export const ensureOnboardingWorkspace = async ({
  userId,
  organizationId,
}: {
  userId: string;
  organizationId: string;
}): Promise<TEnsureOnboardingWorkspaceResult> => {
  await assertCanManageOnboardingWorkspace(userId, organizationId);

  const { organization, isEntitled } = await ensureOrganizationAISmartTools(organizationId);
  const existingWorkspace = await getOnboardingWorkspace(userId, organizationId);

  if (existingWorkspace) {
    return {
      workspace: existingWorkspace,
      isAISmartToolsEnabled: organization.isAISmartToolsEnabled,
      isAISmartToolsEntitled: isEntitled,
    };
  }

  const organizationWorkspaces = await getWorkspaces(organizationId);
  const workspace = await createOnboardingWorkspace({
    organizationId,
    organizationName: organization.name,
    takenNames: organizationWorkspaces.map((item) => item.name),
  });

  trackWorkspaceCreated({ userId, organizationId, workspace });

  return {
    workspace,
    isAISmartToolsEnabled: organization.isAISmartToolsEnabled,
    isAISmartToolsEntitled: isEntitled,
  };
};
