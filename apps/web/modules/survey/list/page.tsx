import { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { DEFAULT_LOCALE, IS_FORMBRICKS_CLOUD, SURVEYS_PER_PAGE } from "@/lib/constants";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { getBillingFallbackPath } from "@/lib/membership/navigation";
import { getUserLocale } from "@/lib/user/service";
import { getTranslate } from "@/lingodotdev/server";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { getProjectWithTeamIdsByEnvironmentId } from "@/modules/survey/lib/project";
import { SurveysList } from "@/modules/survey/list/components/survey-list";

export const metadata: Metadata = {
  title: "Your Surveys",
};

interface SurveyTemplateProps {
  params: Promise<{
    environmentId: string;
  }>;
}

export const SurveysPage = async ({ params: paramsProps }: SurveyTemplateProps) => {
  const publicDomain = getPublicDomain();
  const params = await paramsProps;
  const t = await getTranslate();

  const project = await getProjectWithTeamIdsByEnvironmentId(params.environmentId);

  if (!project) {
    throw new ResourceNotFoundError(t("common.workspace"), null);
  }

  const { session, isBilling, environment, isReadOnly } = await getEnvironmentAuth(params.environmentId);

  if (isBilling) {
    return redirect(getBillingFallbackPath(params.environmentId, IS_FORMBRICKS_CLOUD));
  }

  const currentProjectChannel = project.config.channel ?? null;
  const locale = (await getUserLocale(session.user.id)) ?? DEFAULT_LOCALE;
  const projectWithRequiredProps = {
    ...project,
    brandColor: project.styling?.brandColor?.light ?? null,
    highlightBorderColor: null,
  };

  return (
    <SurveysList
      environment={environment}
      project={projectWithRequiredProps}
      isReadOnly={isReadOnly}
      publicDomain={publicDomain}
      userId={session.user.id}
      surveysPerPage={SURVEYS_PER_PAGE}
      currentProjectChannel={currentProjectChannel}
      locale={locale}
    />
  );
};
