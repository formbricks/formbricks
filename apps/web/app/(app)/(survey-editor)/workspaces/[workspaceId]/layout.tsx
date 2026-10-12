import { redirect } from "next/navigation";
import { AuthenticationError } from "@formbricks/types/errors";
import { WorkspaceContextWrapper } from "@/app/(app)/workspaces/[workspaceId]/context/workspace-context";
import { SurveysQueryClientProvider } from "@/app/(app)/workspaces/[workspaceId]/surveys/query-client-provider";
import { ENTERPRISE_LICENSE_REQUEST_FORM_URL, IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getWorkspaceAuth, workspaceIdLayoutChecks } from "@/modules/workspaces/lib/utils";

const SurveyEditorWorkspaceLayout = async (props: {
  params: Promise<{ workspaceId: string }>;
  children: React.ReactNode;
}) => {
  const params = await props.params;

  const { children } = props;

  const { t, session, user } = await workspaceIdLayoutChecks(params.workspaceId);

  if (!session) {
    return redirect(`/auth/login`);
  }

  if (!user) {
    throw new AuthenticationError(t("common.not_authenticated"));
  }

  // This route group sits outside (app)/workspaces/[workspaceId]/layout.tsx, so it has to mount the
  // workspace context itself. Without it useWorkspace() returns null and every link built from it
  // in the editor points at /workspaces/undefined/... (ENG-2601).
  // The workspace comes from getWorkspaceAuth, not the navigation check above: that check admits the
  // billing role, and getWorkspaceAuth redirects billing away before the workspace reaches the client.
  // Every page under this layout calls it too, so the request cache makes it free.
  const { workspace, organization } = await getWorkspaceAuth(params.workspaceId);

  return (
    <WorkspaceContextWrapper
      workspace={workspace}
      organization={organization}
      deployment={{
        isFormbricksCloud: IS_FORMBRICKS_CLOUD,
        enterpriseLicenseRequestFormUrl: ENTERPRISE_LICENSE_REQUEST_FORM_URL,
      }}>
      <div className="flex h-screen flex-col">
        <div className="h-full overflow-y-auto bg-slate-50">
          <SurveysQueryClientProvider>{children}</SurveysQueryClientProvider>
        </div>
      </div>
    </WorkspaceContextWrapper>
  );
};

export default SurveyEditorWorkspaceLayout;
