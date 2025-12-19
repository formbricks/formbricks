import { redirect } from "next/navigation";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { getTranslate } from "@/lingodotdev/server";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { getProjectWithTeamIdsByEnvironmentId } from "@/modules/survey/lib/project";
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

  const project = await getProjectWithTeamIdsByEnvironmentId(environmentId);

  if (!project) {
    throw new Error(t("common.project_not_found"));
  }

  if (isReadOnly) {
    return redirect(`/environments/${environment.id}/surveys`);
  }

  const publicDomain = getPublicDomain();

  return (
    <TemplateContainerWithPreview
      userId={session.user.id}
      environment={environment}
      project={project}
      publicDomain={publicDomain}
    />
  );
};
