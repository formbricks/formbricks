"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import { ChevronDownIcon, LayoutTemplateIcon, PlusCircleIcon, SparklesIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ComponentProps, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TSurveyCreateInput, TSurveyType } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { TWorkspaceConfigChannel } from "@formbricks/types/workspace";
import { customSurveyTemplate } from "@/app/lib/templates";
import { FORMBRICKS_SURVEYS_FILTERS_KEY_LS } from "@/lib/localStorage";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import type { TAIUnavailableReason } from "@/modules/ee/analysis/charts/lib/ai-availability";
import { createSurveyAction } from "@/modules/survey/components/template-list/actions";
import { CreateWithAIDialog } from "@/modules/survey/components/template-list/components/create-with-ai-dialog";
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
import { EmptyState } from "@/modules/ui/components/empty-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { SurveyCard } from "./survey-card";
import { SurveyFilters } from "./survey-filters";
import { SurveyLoading } from "./survey-loading";

interface SurveysListProps {
  workspace: ComponentProps<typeof TemplateContainerWithPreview>["workspace"];
  userId: string;
  publicDomain: string;
  isReadOnly: boolean;
  surveysPerPage: number;
  currentWorkspaceChannel: TWorkspaceConfigChannel;
  locale: TUserLocale;
  isAIAvailable: boolean;
  aiUnavailableReason?: TAIUnavailableReason;
}

type NewSurveyMenuProps = {
  workspace: ComponentProps<typeof TemplateContainerWithPreview>["workspace"];
  userId: string;
  language: TUserLocale;
  isAIAvailable: boolean;
  aiUnavailableReason?: TAIUnavailableReason;
};

const NewSurveyMenu = ({
  workspace,
  userId,
  language,
  isAIAvailable,
  aiUnavailableReason,
}: NewSurveyMenuProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [isAIDialogOpen, setIsAIDialogOpen] = useState(false);
  const [isCreatingBlankSurvey, setIsCreatingBlankSurvey] = useState(false);
  const workspaceBasePath = `/workspaces/${workspace.id}`;

  const surveyType: TSurveyType = useMemo(() => {
    if (workspace.config.channel) {
      if (workspace.config.channel === "website") {
        return "app";
      }

      return workspace.config.channel;
    }

    return "link";
  }, [workspace.config.channel]);

  const handleStartFromScratch = async () => {
    setIsCreatingBlankSurvey(true);

    try {
      const customSurvey = customSurveyTemplate(t);
      const surveyBody: TSurveyCreateInput = {
        ...customSurvey.preset,
        type: surveyType,
        createdBy: userId,
      };

      const response = await createSurveyAction({
        workspaceId: workspace.id,
        surveyBody,
        createdFrom: "blank",
      });

      if (response?.data) {
        router.push(`${workspaceBasePath}/surveys/${response.data.id}/edit`);
        return;
      }

      toast.error(getFormattedErrorMessage(response));
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again")));
    } finally {
      setIsCreatingBlankSurvey(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm">
            {t("workspace.surveys.new_survey")}
            <ChevronDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem
            icon={<SparklesIcon className="size-4" />}
            onSelect={() => setIsAIDialogOpen(true)}>
            {t("workspace.surveys.ai_create.create_with_ai")}
          </DropdownMenuItem>
          <DropdownMenuItem
            icon={<LayoutTemplateIcon className="size-4" />}
            onSelect={() => router.push(`${workspaceBasePath}/surveys/templates`)}>
            {t("workspace.surveys.ai_create.choose_template")}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isCreatingBlankSurvey}
            icon={<PlusCircleIcon className="size-4" />}
            onSelect={(event) => {
              event.preventDefault();
              void handleStartFromScratch();
            }}>
            {t("workspace.surveys.ai_create.start_from_scratch")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CreateWithAIDialog
        workspaceId={workspace.id}
        language={language}
        isAIAvailable={isAIAvailable}
        aiUnavailableReason={aiUnavailableReason}
        open={isAIDialogOpen}
        onOpenChange={setIsAIDialogOpen}
      />
    </>
  );
};

export const SurveysList = ({
  workspace,
  userId,
  publicDomain,
  isReadOnly,
  surveysPerPage,
  currentWorkspaceChannel,
  locale,
  isAIAvailable,
  aiUnavailableReason,
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
    const parsedFilters = parseStoredSurveyFilters(storedFilters, currentWorkspaceChannel);

    if (storedFilters && !parsedFilters) {
      globalThis.window.localStorage.removeItem(FORMBRICKS_SURVEYS_FILTERS_KEY_LS);
      setSurveyFilters(initialFilters);
    } else if (parsedFilters) {
      setSurveyFilters(parsedFilters);
    }

    setIsFilterInitialized(true);
  }, [currentWorkspaceChannel]);

  const normalizedFilters = useMemo(
    () => normalizeSurveyFilters(surveyFilters, currentWorkspaceChannel),
    [currentWorkspaceChannel, surveyFilters]
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
    workspaceId: workspace.id,
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
    <NewSurveyMenu
      workspace={workspace}
      userId={userId}
      language={locale}
      isAIAvailable={isAIAvailable}
      aiUnavailableReason={aiUnavailableReason}
    />
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
        workspace={workspace}
        isTemplatePage={false}
        publicDomain={publicDomain}
        language={locale}
        isAIAvailable={isAIAvailable}
        aiUnavailableReason={aiUnavailableReason}
      />
    );
  }

  if (showReadOnlyEmptyState) {
    return (
      <PageContentWrapper>
        <PageHeader pageTitle={t("common.surveys")} />
        <EmptyState text={t("workspace.surveys.read_only_user_not_allowed_to_create_survey_warning")} />
      </PageContentWrapper>
    );
  }

  let surveyContent = (
    <div className="flex h-full w-full">
      <div className="flex w-full flex-col items-center justify-center text-slate-600">
        <span className="size-24 p-4 text-center text-5xl">🕵️</span>
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
          currentWorkspaceChannel={currentWorkspaceChannel}
        />
        {surveyContent}
      </div>
    </PageContentWrapper>
  );
};
