import { redirect } from "next/navigation";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { getTranslate } from "@/lingodotdev/server";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { getWorkspaceWithTeamIdsByEnvironmentId } from "@/modules/survey/lib/workspace";
import { TemplateContainerWithPreview } from "./components/template-container";

interface SurveyTemplateProps {
  params: Promise<{
    environmentId: string;
  }>;
}

export const SurveyTemplatesPage = async (props: SurveyTemplateProps) => {
  const t = await getTranslate();
  const params = await props.params;
  const environmentId = params.environmentId;

  const { session, environment, isReadOnly } = await getEnvironmentAuth(environmentId);

  const workspace = await getWorkspaceWithTeamIdsByEnvironmentId(environmentId);

  if (!workspace) {
    throw new ResourceNotFoundError(t("common.workspace"), null);
  }

  if (isReadOnly) {
    return redirect(`/environments/${environment.id}/surveys`);
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
