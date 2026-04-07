import { redirect } from "next/navigation";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { getTranslate } from "@/lingodotdev/server";
import { getWorkspaceWithTeamIds } from "@/modules/survey/lib/workspace";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { TemplateContainerWithPreview } from "./components/template-container";

interface SurveyTemplateProps {
  params: Promise<{
    workspaceId: string;
  }>;
}

export const SurveyTemplatesPage = async (props: SurveyTemplateProps) => {
  const t = await getTranslate();
  const params = await props.params;
  const workspaceId = params.workspaceId;

  const { session, environment, isReadOnly } = await getWorkspaceAuth(workspaceId);

  const workspace = await getWorkspaceWithTeamIds(workspaceId);

  if (!workspace) {
    throw new ResourceNotFoundError(t("common.workspace"), null);
  }

  if (isReadOnly) {
    return redirect(`/workspaces/${workspace.id}/surveys`);
  }

  const publicDomain = getPublicDomain();

  return (
    <TemplateContainerWithPreview
      userId={session.user.id}
      environment={environment}
      workspace={workspace}
      publicDomain={publicDomain}
    />
  );
};
