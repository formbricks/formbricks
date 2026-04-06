import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { EnvironmentLayout } from "@/app/(app)/workspaces/[workspaceId]/components/EnvironmentLayout";
import { EnvironmentContextWrapper } from "@/app/(app)/workspaces/[workspaceId]/context/environment-context";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { getWorkspaceLayoutData } from "@/modules/environments/lib/utils";
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
      <WorkspaceStorageHandler workspaceId={params.workspaceId} environmentId={layoutData.environment.id} />
      <EnvironmentContextWrapper
        environment={layoutData.environment}
        workspace={layoutData.workspace}
        organization={layoutData.organization}>
        <EnvironmentLayout layoutData={layoutData}>{children}</EnvironmentLayout>
      </EnvironmentContextWrapper>
    </>
  );
};

export default WorkspaceLayout;
