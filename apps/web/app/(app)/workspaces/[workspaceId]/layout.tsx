import { redirect } from "next/navigation";
import { WorkspaceLayout as WorkspaceLayoutComponent } from "@/app/(app)/workspaces/[workspaceId]/components/WorkspaceLayout";
import { WorkspaceContextWrapper } from "@/app/(app)/workspaces/[workspaceId]/context/workspace-context";
import { PostHogGroupIdentify } from "@/app/posthog/PostHogGroupIdentify";
import { POSTHOG_KEY } from "@/lib/constants";
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

  return (
    <>
      <WorkspaceStorageHandler workspaceId={params.workspaceId} />
      {POSTHOG_KEY && (
        <PostHogGroupIdentify
          organizationId={layoutData.organization.id}
          organizationName={layoutData.organization.name}
          workspaceId={layoutData.workspace.id}
          workspaceName={layoutData.workspace.name}
        />
      )}
      <WorkspaceContextWrapper workspace={layoutData.workspace} organization={layoutData.organization}>
        <WorkspaceLayoutComponent layoutData={layoutData}>{children}</WorkspaceLayoutComponent>
      </WorkspaceContextWrapper>
    </>
  );
};

export default WorkspaceLayout;
