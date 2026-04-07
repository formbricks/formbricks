import { PlusIcon } from "lucide-react";
import { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { DEFAULT_LOCALE, SURVEYS_PER_PAGE } from "@/lib/constants";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { getUserLocale } from "@/lib/user/service";
import { getTranslate } from "@/lingodotdev/server";
import { getWorkspaceWithTeamIds } from "@/modules/survey/lib/workspace";
import { SurveysList } from "@/modules/survey/list/components/survey-list";
import { getSurveyCount } from "@/modules/survey/list/lib/survey";
import { TemplateContainerWithPreview } from "@/modules/survey/templates/components/template-container";
import { Button } from "@/modules/ui/components/button";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";

export const metadata: Metadata = {
  title: "Your Surveys",
};

interface SurveyTemplateProps {
  params: Promise<{
    workspaceId: string;
  }>;
}

export const SurveysPage = async ({ params: paramsProps }: SurveyTemplateProps) => {
  const publicDomain = getPublicDomain();
  const params = await paramsProps;
  const t = await getTranslate();

  const workspace = await getWorkspaceWithTeamIds(params.workspaceId);

  if (!workspace) {
    throw new ResourceNotFoundError(t("common.workspace"), null);
  }

  const { session, isBilling, environment, isReadOnly } = await getWorkspaceAuth(params.workspaceId);

  if (isBilling) {
    return redirect(`/workspaces/${workspace.id}/settings/billing`);
  }

  const surveyCount = await getSurveyCount(params.workspaceId);

  const currentWorkspaceChannel = workspace.config.channel ?? null;
  const locale = (await getUserLocale(session.user.id)) ?? DEFAULT_LOCALE;
  const workspaceBasePath = `/workspaces/${workspace.id}`;
  const CreateSurveyButton = () => {
    return (
      <Button size="sm" asChild>
        <Link href={`${workspaceBasePath}/surveys/templates`}>
          {t("workspace.surveys.new_survey")}
          <PlusIcon />
        </Link>
      </Button>
    );
  };

  const workspaceWithRequiredProps = {
    ...workspace,
    brandColor: workspace.styling?.brandColor?.light ?? null,
    highlightBorderColor: null,
  };

  if (surveyCount === 0)
    return (
      <TemplateContainerWithPreview
        userId={session.user.id}
        environment={environment}
        workspace={workspaceWithRequiredProps}
        isTemplatePage={false}
        publicDomain={publicDomain}
      />
    );

  let content;
  if (surveyCount > 0) {
    content = (
      <>
        <PageHeader pageTitle={t("common.surveys")} cta={isReadOnly ? <></> : <CreateSurveyButton />} />
        <SurveysList
          environmentId={environment.id}
          isReadOnly={isReadOnly}
          publicDomain={publicDomain}
          userId={session.user.id}
          surveysPerPage={SURVEYS_PER_PAGE}
          currentWorkspaceChannel={currentWorkspaceChannel}
          locale={locale}
        />
      </>
    );
  } else if (isReadOnly) {
    content = (
      <>
        <h1 className="px-6 text-3xl font-extrabold text-slate-700">
          {t("workspace.surveys.no_surveys_created_yet")}
        </h1>

        <h2 className="px-6 text-lg font-medium text-slate-500">
          {t("workspace.surveys.read_only_user_not_allowed_to_create_survey_warning")}
        </h2>
      </>
    );
  }

  return <PageContentWrapper>{content}</PageContentWrapper>;
};
