import { redirect } from "next/navigation";
import { AuthenticationError, ResourceNotFoundError } from "@formbricks/types/errors";
import { getWorkspace } from "@/lib/workspace/service";
import { workspaceIdLayoutChecks } from "@/modules/workspaces/lib/utils";

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

  const workspace = await getWorkspace(params.workspaceId);

  if (!workspace) {
    throw new ResourceNotFoundError(t("common.workspace"), params.workspaceId);
  }

  const environment = workspace.environments[0];

  if (!environment) {
    throw new ResourceNotFoundError(t("common.environment"), null);
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="h-full overflow-y-auto bg-slate-50">{children}</div>
    </div>
  );
};

export default SurveyEditorWorkspaceLayout;
