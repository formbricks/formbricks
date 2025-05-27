import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { TemplateList } from "@/modules/survey/components/template-list";
import { getProjectByEnvironmentId } from "@/modules/survey/lib/project";
import { SurveysList } from "@/modules/survey/list/components/survey-list";
import { getSurveyCount } from "@/modules/survey/list/lib/survey";
import { Button } from "@/modules/ui/components/button";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";
import { PlusIcon } from "lucide-react";
import { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSelectorsByUserAgent } from "react-device-detect";
import { SURVEYS_PER_PAGE } from "@formbricks/lib/constants";
import { getSurveyDomain } from "@formbricks/lib/getSurveyUrl";
import { TTemplateRole } from "@formbricks/types/templates";

export const metadata: Metadata = {
  title: "Your Engagements",
};

interface SurveyTemplateProps {
  params: Promise<{
    environmentId: string;
  }>;
  searchParams: Promise<{
    role?: TTemplateRole;
  }>;
}

export const SurveysPage = async ({
  params: paramsProps,
  searchParams: searchParamsProps,
}: SurveyTemplateProps) => {
  const surveyDomain = getSurveyDomain();
  const searchParams = await searchParamsProps;
  const params = await paramsProps;
  const t = await getTranslate();
  const headersList = await headers();
  const userAgent = headersList.get("user-agent");
  const { isMobile } = getSelectorsByUserAgent(userAgent ?? "");

  const project = await getProjectByEnvironmentId(params.environmentId);

  if (!project) {
    throw new Error(t("common.project_not_found"));
  }

  const { session, isBilling, environment, currentUserMembership } = await getEnvironmentAuth(
    params.environmentId
  );

  const prefilledFilters = [project?.config.channel, project.config.industry, searchParams.role ?? null];

  if (isBilling) {
    return redirect(`/environments/${params.environmentId}/settings/billing`);
  }

  const surveyCount = await getSurveyCount(params.environmentId, currentUserMembership.userId);

  const currentProjectChannel = project.config.channel ?? null;
  const CreateSurveyButton = () => {
    return (
      <Button size="sm" asChild>
        <Link href={`/environments/${environment.id}/engagements/templates`}>
          <span className="hidden sm:inline">{t("environments.surveys.new_survey")}</span>
          <PlusIcon />
        </Link>
      </Button>
    );
  };

  const projectWithRequiredProps = {
    ...project,
    brandColor: project.styling?.brandColor?.light ?? null,
    highlightBorderColor: null,
  };

  let content;
  if (isMobile) {
    content = (
      <>
        <PageHeader pageTitle={t("common.surveys")} />
        <div className="text-sm font-bold text-slate-700">
          <p>
            {t("common.creating_not_supported")}
            <br />
            <br />
            {t("common.please_use_a_desktop_browser")}
          </p>
        </div>
      </>
    );
  } else if (surveyCount > 0) {
    content = (
      <>
        <PageHeader pageTitle={t("common.surveys")} cta={<CreateSurveyButton />} />
        <SurveysList
          environmentId={environment.id}
          surveyDomain={surveyDomain}
          userId={session.user.id}
          surveysPerPage={SURVEYS_PER_PAGE}
          currentProjectChannel={currentProjectChannel}
          isMobile={isMobile}
        />
      </>
    );
  } else {
    content = (
      <>
        <h1 className="px-6 text-3xl font-extrabold text-slate-700">
          {t("environments.surveys.all_set_time_to_create_first_survey")}
        </h1>
        <TemplateList
          environmentId={environment.id}
          project={projectWithRequiredProps}
          userId={session.user.id}
          prefilledFilters={prefilledFilters}
        />
      </>
    );
  }

  return <PageContentWrapper>{content}</PageContentWrapper>;
};
