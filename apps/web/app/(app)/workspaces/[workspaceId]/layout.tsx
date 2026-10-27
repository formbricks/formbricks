import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { WorkspaceLayout as WorkspaceLayoutComponent } from "@/app/(app)/workspaces/[workspaceId]/components/WorkspaceLayout";
import { WorkspaceContextWrapper } from "@/app/(app)/workspaces/[workspaceId]/context/workspace-context";
import { PostHogGroupIdentify } from "@/app/posthog/PostHogGroupIdentify";
import { ENTERPRISE_LICENSE_REQUEST_FORM_URL, IS_FORMBRICKS_CLOUD, POSTHOG_KEY } from "@/lib/constants";
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

  // Must stay above getWorkspaceLayoutData: it opens the `page` authorization surface, which calls
  // `after()`. Once a request closes mid-render, Next flips every store that called `after()` to phase
  // "after", and a later `cookies()` call throws (ENG-3375). A store read before that stays usable.
  const cookieStore = await cookies();

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
      <WorkspaceContextWrapper
        workspace={layoutData.workspace}
        organization={layoutData.organization}
        deployment={{
          isFormbricksCloud: IS_FORMBRICKS_CLOUD,
          enterpriseLicenseRequestFormUrl: ENTERPRISE_LICENSE_REQUEST_FORM_URL,
        }}>
        <WorkspaceLayoutComponent layoutData={layoutData} cookieStore={cookieStore}>
          {children}
        </WorkspaceLayoutComponent>
      </WorkspaceContextWrapper>
    </>
  );
};

export default WorkspaceLayout;
