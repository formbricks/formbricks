import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { getProjectByEnvironmentId } from "@/modules/survey/lib/project";
import { redirect } from "next/navigation";
import { TProjectConfigChannel, TProjectConfigIndustry } from "@formbricks/types/project";
import { TTemplateRole } from "@formbricks/types/templates";
import { TemplateContainerWithPreview } from "./components/template-container";

interface SurveyTemplateProps {
  params: Promise<{
    environmentId: string;
  }>;
  searchParams: Promise<{
    channel?: TProjectConfigChannel;
    industry?: TProjectConfigIndustry;
    role?: TTemplateRole;
  }>;
}

export const SurveyTemplatesPage = async (props: SurveyTemplateProps) => {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const environmentId = params.environmentId;

  const { session, environment, isReadOnly } = await getEnvironmentAuth(environmentId);

  const project = await getProjectByEnvironmentId(environmentId);

  if (!project) {
    throw new Error("Project not found");
  }

  if (isReadOnly) {
    return redirect(`/environments/${environment.id}/surveys`);
  }

  const prefilledFilters = [project.config.channel, project.config.industry, searchParams.role ?? null];

  return (
    <TemplateContainerWithPreview
      userId={session.user.id}
      environment={environment}
      project={project}
      prefilledFilters={prefilledFilters}
      // AI Survey Creation -- Need improvement
      isAIEnabled={false}
    />
  );
};
