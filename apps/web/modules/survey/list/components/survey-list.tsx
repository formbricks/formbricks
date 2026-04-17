"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { type ComponentProps, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { TProjectConfigChannel } from "@formbricks/types/project";
import { TUserLocale } from "@formbricks/types/user";
import { FORMBRICKS_SURVEYS_FILTERS_KEY_LS } from "@/lib/localStorage";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { useDeleteSurvey } from "@/modules/survey/list/hooks/use-delete-survey";
import { useSurveys } from "@/modules/survey/list/hooks/use-surveys";
import { initialFilters } from "@/modules/survey/list/lib/constants";
import {
  hasActiveSurveyFilters,
  normalizeSurveyFilters,
  parseStoredSurveyFilters,
} from "@/modules/survey/list/lib/utils";
import { TSurveyOverviewFilters } from "@/modules/survey/list/types/survey-overview";
import { TemplateContainerWithPreview } from "@/modules/survey/templates/components/template-container";
import { Button } from "@/modules/ui/components/button";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { SurveyCard } from "./survey-card";
import { SurveyFilters } from "./survey-filters";
import { SurveyLoading } from "./survey-loading";

interface SurveysListProps {
  environment: ComponentProps<typeof TemplateContainerWithPreview>["environment"];
  project: ComponentProps<typeof TemplateContainerWithPreview>["project"];
  userId: string;
  publicDomain: string;
  isReadOnly: boolean;
  surveysPerPage: number;
  currentProjectChannel: TProjectConfigChannel;
  locale: TUserLocale;
}

export const SurveysList = ({
  environment,
  project,
  userId,
  publicDomain,
  isReadOnly,
  surveysPerPage,
  currentProjectChannel,
  locale,
}: SurveysListProps) => {
  const { t } = useTranslation();
  const [surveyFilters, setSurveyFilters] = useState<TSurveyOverviewFilters>(initialFilters);
  const [isFilterInitialized, setIsFilterInitialized] = useState(false);
  const [parent] = useAutoAnimate();

  useEffect(() => {
    if (typeof globalThis.window === "undefined") {
      return;
    }

    const storedFilters = globalThis.window.localStorage.getItem(FORMBRICKS_SURVEYS_FILTERS_KEY_LS);
    const parsedFilters = parseStoredSurveyFilters(storedFilters, currentProjectChannel);

    if (storedFilters && !parsedFilters) {
      globalThis.window.localStorage.removeItem(FORMBRICKS_SURVEYS_FILTERS_KEY_LS);
      setSurveyFilters(initialFilters);
    } else if (parsedFilters) {
      setSurveyFilters(parsedFilters);
    }

    setIsFilterInitialized(true);
  }, [currentProjectChannel]);

  const normalizedFilters = useMemo(
    () => normalizeSurveyFilters(surveyFilters, currentProjectChannel),
    [currentProjectChannel, surveyFilters]
  );

  useEffect(() => {
    if (!isFilterInitialized || typeof globalThis.window === "undefined") {
      return;
    }

    globalThis.window.localStorage.setItem(
      FORMBRICKS_SURVEYS_FILTERS_KEY_LS,
      JSON.stringify(normalizedFilters)
    );
  }, [normalizedFilters, isFilterInitialized]);

  const {
    error,
    fetchNextPage,
    hasNextPage,
    isError,
    isFetchingNextPage,
    isLoading,
    queryKey,
    refetch,
    surveys,
    totalCount,
  } = useSurveys({
    workspaceId: environment.id,
    limit: surveysPerPage,
    filters: normalizedFilters,
    enabled: isFilterInitialized,
  });

  const deleteSurveyMutation = useDeleteSurvey({ queryKey });

  const hasAppliedFilters = hasActiveSurveyFilters(normalizedFilters);
  const showInitialLoading = !isFilterInitialized || (isLoading && surveys.length === 0);
  const showTemplateEmptyState = !isError && totalCount === 0 && !hasAppliedFilters && !isReadOnly;
  const showReadOnlyEmptyState = !isError && totalCount === 0 && !hasAppliedFilters && isReadOnly;

  const handleDeleteSurvey = async (surveyId: string) => {
    await deleteSurveyMutation.mutateAsync({ surveyId });
  };

  const createSurveyButton = (
    <Button size="sm" asChild>
      <Link href={`/environments/${environment.id}/surveys/templates`}>
        {t("environments.surveys.new_survey")}
        <PlusIcon />
      </Link>
    </Button>
  );

  if (showInitialLoading) {
    return (
      <PageContentWrapper>
        <PageHeader pageTitle={t("common.surveys")} />
        <div className="flex items-center justify-between">
          <div className="flex h-9 animate-pulse gap-2">
            <div className="w-48 rounded-md bg-slate-300"></div>
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-24 rounded-md bg-slate-300"></div>
            ))}
          </div>
          <div className="flex h-9 animate-pulse gap-2">
            <div className="w-36 rounded-md bg-slate-300"></div>
          </div>
        </div>
        <SurveyLoading />
      </PageContentWrapper>
    );
  }

  if (showTemplateEmptyState) {
    return (
      <TemplateContainerWithPreview
        userId={userId}
        environment={environment}
        project={project}
        isTemplatePage={false}
        publicDomain={publicDomain}
      />
    );
  }

  if (showReadOnlyEmptyState) {
    return (
      <PageContentWrapper>
        <h1 className="px-6 text-3xl font-extrabold text-slate-700">
          {t("environments.surveys.no_surveys_created_yet")}
        </h1>
        <h2 className="px-6 text-lg font-medium text-slate-500">
          {t("environments.surveys.read_only_user_not_allowed_to_create_survey_warning")}
        </h2>
      </PageContentWrapper>
    );
  }

  let surveyContent = (
    <div className="flex h-full w-full">
      <div className="flex w-full flex-col items-center justify-center text-slate-600">
        <span className="h-24 w-24 p-4 text-center text-5xl">🕵️</span>
        {t("common.no_surveys_found")}
      </div>
    </div>
  );

  if (isError && surveys.length === 0) {
    surveyContent = (
      <div className="flex w-full flex-col items-center justify-center gap-4 py-16 text-slate-600">
        <p>{getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again"))}</p>
        <Button variant="secondary" size="sm" onClick={() => refetch()}>
          {t("common.try_again")}
        </Button>
      </div>
    );
  } else if (surveys.length > 0) {
    surveyContent = (
      <div>
        <div className="flex-col space-y-3" ref={parent}>
          <div className="mt-6 grid w-full grid-cols-8 place-items-center gap-3 px-6 pr-8 text-sm text-slate-800">
            <div className="col-span-2 place-self-start">{t("common.name")}</div>
            <div className="col-span-1">{t("common.status")}</div>
            <div className="col-span-1">{t("common.responses")}</div>
            <div className="col-span-1">{t("common.type")}</div>
            <div className="col-span-1">{t("common.created_at")}</div>
            <div className="col-span-1">{t("common.updated_at")}</div>
            <div className="col-span-1">{t("common.created_by")}</div>
          </div>
          {surveys.map((survey) => (
            <SurveyCard
              key={survey.id}
              survey={survey}
              environmentId={environment.id}
              isReadOnly={isReadOnly}
              deleteSurvey={handleDeleteSurvey}
              publicDomain={publicDomain}
              locale={locale}
            />
          ))}
        </div>

        {hasNextPage && (
          <div className="flex justify-center py-5">
            <Button
              onClick={() => fetchNextPage()}
              variant="secondary"
              size="sm"
              loading={isFetchingNextPage}>
              {t("common.load_more")}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.surveys")} cta={isReadOnly ? <></> : createSurveyButton} />
      <div className="space-y-6">
        <SurveyFilters
          surveyFilters={normalizedFilters}
          setSurveyFilters={setSurveyFilters}
          currentProjectChannel={currentProjectChannel}
        />
        {surveyContent}
      </div>
    </PageContentWrapper>
  );
};
