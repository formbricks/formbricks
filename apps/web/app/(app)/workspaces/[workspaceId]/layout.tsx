import { redirect } from "next/navigation";
import { logger } from "@formbricks/logger";
import { WorkspaceLayout as WorkspaceLayoutComponent } from "@/app/(app)/workspaces/[workspaceId]/components/WorkspaceLayout";
import { WorkspaceContextWrapper } from "@/app/(app)/workspaces/[workspaceId]/context/workspace-context";
import { PostHogGroupIdentify } from "@/app/posthog/PostHogGroupIdentify";
import { POSTHOG_KEY } from "@/lib/constants";
import { getOrganizationRolePersonProperties } from "@/lib/posthog/organization-roles";
import { getSession } from "@/modules/auth/lib/session";
import { getWorkspaceLayoutData } from "@/modules/workspaces/lib/utils";
import WorkspaceStorageHandler from "./components/WorkspaceStorageHandler";

const WorkspaceLayout = async (props: {
  params: Promise<{ workspaceId: string }>;
  children: React.ReactNode;
}) => {
  const params = await props.params;
  const { children } = props;

  const session = await getSession();
  if (!session?.user) {
    return redirect(`/auth/login`);
  }

  const layoutData = await getWorkspaceLayoutData(params.workspaceId, session.user.id);

  // Full role snapshot across every org the person belongs to, not just this workspace's org —
  // see lib/posthog/organization-roles.ts. Best-effort: this is read-only analytics enrichment and
  // must never fail the workspace page render if the lookup errors.
  let organizationRoleProperties: Awaited<ReturnType<typeof getOrganizationRolePersonProperties>> | null =
    null;
  if (POSTHOG_KEY) {
    try {
      organizationRoleProperties = await getOrganizationRolePersonProperties(session.user.id);
    } catch (error) {
      logger.warn({ error }, "Failed to load organization role properties for PostHog");
    }
  }

  return (
    <>
      <WorkspaceStorageHandler workspaceId={params.workspaceId} />
      {POSTHOG_KEY && organizationRoleProperties && (
        <PostHogGroupIdentify
          organizationId={layoutData.organization.id}
          organizationName={layoutData.organization.name}
          workspaceId={layoutData.workspace.id}
          workspaceName={layoutData.workspace.name}
          organizationRoles={organizationRoleProperties.organization_roles}
          organizationCount={organizationRoleProperties.organization_count}
        />
      )}
      <WorkspaceContextWrapper workspace={layoutData.workspace} organization={layoutData.organization}>
        <WorkspaceLayoutComponent layoutData={layoutData}>{children}</WorkspaceLayoutComponent>
      </WorkspaceContextWrapper>
    </>
  );
};

export default WorkspaceLayout;
