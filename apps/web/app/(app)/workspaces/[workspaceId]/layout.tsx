import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { WorkspaceLayout as WorkspaceLayoutComponent } from "@/app/(app)/workspaces/[workspaceId]/components/WorkspaceLayout";
import { WorkspaceContextWrapper } from "@/app/(app)/workspaces/[workspaceId]/context/workspace-context";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { getWorkspaceLayoutData } from "@/modules/workspaces/lib/utils";
import WorkspaceStorageHandler from "./components/WorkspaceStorageHandler";

const WorkspaceLayout = async (props: {
  params: Promise<{ workspaceId: string }>;
  children: React.ReactNode;
}) => {
  const params = await props.params;
  const { children } = props;

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return redirect(`/auth/login`);
  }

  const layoutData = await getWorkspaceLayoutData(params.workspaceId, session.user.id);

  return (
    <>
      <WorkspaceStorageHandler workspaceId={params.workspaceId} />
      <WorkspaceContextWrapper workspace={layoutData.workspace} organization={layoutData.organization}>
        <WorkspaceLayoutComponent layoutData={layoutData}>{children}</WorkspaceLayoutComponent>
      </WorkspaceContextWrapper>
    </>
  );
};

export default WorkspaceLayout;
