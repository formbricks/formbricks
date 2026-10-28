"use client";

import { ChevronDownIcon, LayoutTemplateIcon, PlusCircleIcon, UploadIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ComponentProps, useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TSurveyStatus, TSurveyType, TSurveyVisibility } from "@formbricks/types/surveys/types";
import type { TUserLocale } from "@formbricks/types/user";
import type { TWorkspaceConfigChannel } from "@formbricks/types/workspace";
import { CUSTOM_SURVEY_TEMPLATE_ID } from "@/app/lib/templates";
import type { TAIUnavailableReason } from "@/lib/ai/service";
import { removeStaleFilterStorage } from "@/lib/stale-filter-storage";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { SurveyDeleteBlockedDialog } from "@/modules/ee/creatives/components/survey-side/survey-delete-blocked-dialog";
import { CreateWithAIDialog } from "@/modules/survey/components/template-list/components/create-with-ai-dialog";
import { useCreateSurveyFromTemplate } from "@/modules/survey/components/template-list/hooks/use-create-survey-from-template";
import { ImportSurveyDialog } from "@/modules/survey/import/components/import-survey-dialog";
import { useArchiveSurvey } from "@/modules/survey/list/hooks/use-archive-survey";
import { useDeleteSurvey } from "@/modules/survey/list/hooks/use-delete-survey";
import { useRenameSurvey } from "@/modules/survey/list/hooks/use-rename-survey";
import { useRestoreSurvey } from "@/modules/survey/list/hooks/use-restore-survey";
import { useSurveys } from "@/modules/survey/list/hooks/use-surveys";
import { useUpdateSurveyStatus } from "@/modules/survey/list/hooks/use-update-survey-status";
import { initialFilters } from "@/modules/survey/list/lib/constants";
import {
  DEFAULT_SURVEY_SORT,
  SURVEY_SORT_VALUES,
  getSurveyFilterProperties,
  getSurveySortOptions,
  isShowingArchived,
  setShowArchived,
  toSurveyListFilters,
} from "@/modules/survey/list/lib/table-filters";
import { normalizeSurveyFilters } from "@/modules/survey/list/lib/utils";
import type { TSurveyListItem } from "@/modules/survey/list/types/survey-overview";
import { TemplateContainerWithPreview } from "@/modules/survey/templates/components/template-container";
import { useUpdateSurveyVisibility } from "@/modules/survey/visibility/hooks/use-update-survey-visibility";
import {
  type TSurveyVisibilityUiGate,
  withoutVisibilityControls,
} from "@/modules/survey/visibility/lib/state";
import type { TSurveyVisibilityBlocker } from "@/modules/survey/visibility/types";
import { AiIcon } from "@/modules/ui/components/ai";
import { Button } from "@/modules/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { EmptyState } from "@/modules/ui/components/empty-state";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { TableToolbar } from "@/modules/ui/components/table-toolbar";
import { useTableColumnState } from "@/modules/ui/components/table-toolbar/hooks/use-table-column-state";
import { useTableUrlState } from "@/modules/ui/components/table-toolbar/hooks/use-table-url-state";
import { buildColumnSettings } from "@/modules/ui/components/table-toolbar/lib/column-settings";
import { FeaturedTemplates } from "./featured-templates";
import { SurveyLoading } from "./survey-loading";
import { SURVEY_TABLE_COLUMN_IDS, SurveysTable, getSurveyColumnLabels } from "./surveys-table";

// One shared empty list, so filters that match nothing do not hand the table a new array each render.
const NO_SURVEYS: TSurveyListItem[] = [];

interface SurveysListProps {
  workspace: ComponentProps<typeof TemplateContainerWithPreview>["workspace"];
  publicDomain: string;
  isReadOnly: boolean;
  surveysPerPage: number;
  currentWorkspaceChannel: TWorkspaceConfigChannel;
  locale: TUserLocale;
  /** The language new surveys are authored in — see `resolveDefaultSurveyLanguage`. */
  defaultSurveyLanguage: string;
  isAIAvailable: boolean;
  aiUnavailableReason?: TAIUnavailableReason;
  showFeaturedTemplates?: boolean;
  /** ENG-3395: the server-side restricted-surveys gate — see `TSurveyVisibilityUiGate`. */
  surveyVisibilityGate: TSurveyVisibilityUiGate;
  currentUserId: string;
}

type NewSurveyMenuProps = {
  workspace: ComponentProps<typeof TemplateContainerWithPreview>["workspace"];
  language: TUserLocale;
  defaultSurveyLanguage: string;
  isAIAvailable: boolean;
  aiUnavailableReason?: TAIUnavailableReason;
};

const NewSurveyMenu = ({
  workspace,
  language,
  defaultSurveyLanguage,
  isAIAvailable,
  aiUnavailableReason,
}: Readonly<NewSurveyMenuProps>) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [isAIDialogOpen, setIsAIDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const createSurveyMutation = useCreateSurveyFromTemplate();
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
    try {
      const survey = await createSurveyMutation.mutateAsync({
        workspaceId: workspace.id,
        templateId: CUSTOM_SURVEY_TEMPLATE_ID,
        source: "custom",
        surveyType,
        defaultLanguage: defaultSurveyLanguage,
      });

      router.push(`${workspaceBasePath}/surveys/${survey.id}/edit`);
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again")));
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
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem icon={<AiIcon />} onSelect={() => setIsAIDialogOpen(true)}>
            {t("workspace.surveys.ai_create.create_with_ai")}
          </DropdownMenuItem>
          <DropdownMenuItem
            data-testid="import-survey-menu-item"
            icon={<UploadIcon className="size-4" />}
            onSelect={() => setIsImportDialogOpen(true)}>
            {t("workspace.surveys.import.menu_item")}
          </DropdownMenuItem>
          <DropdownMenuItem
            icon={<LayoutTemplateIcon className="size-4" />}
            onSelect={() => router.push(`${workspaceBasePath}/surveys/templates`)}>
            {t("workspace.surveys.ai_create.choose_template")}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={createSurveyMutation.isPending}
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
      <ImportSurveyDialog
        workspaceId={workspace.id}
        isAIAvailable={isAIAvailable}
        aiUnavailableReason={aiUnavailableReason}
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
      />
    </>
  );
};

export const SurveysList = ({
  workspace,
  publicDomain,
  isReadOnly,
  surveysPerPage,
  currentWorkspaceChannel,
  locale,
  defaultSurveyLanguage,
  isAIAvailable,
  aiUnavailableReason,
  showFeaturedTemplates = false,
  surveyVisibilityGate,
}: Readonly<SurveysListProps>) => {
  const { t } = useTranslation();
  // Set when a visibility request answers `visibility_not_enabled`: changing visibility was switched off
  // after this page rendered, so every visibility control goes away until the next load. The markers
  // stay: what is enforced is not decided by that answer.
  const [isVisibilityTurnedOff, setIsVisibilityTurnedOff] = useState(false);
  const visibilityGate = isVisibilityTurnedOff
    ? withoutVisibilityControls(surveyVisibilityGate)
    : surveyVisibilityGate;
  // A refused delete (409: creatives open the survey) is shown here, not in the row: the optimistic
  // removal has unmounted the row by the time the answer arrives.
  const [isDeleteBlockedDialogOpen, setDeleteBlockedDialogOpen] = useState(false);
  const [deleteBlockers, setDeleteBlockers] = useState<TSurveyVisibilityBlocker[]>([]);

  useEffect(() => removeStaleFilterStorage(globalThis.window?.localStorage), []);

  const filterProperties = getSurveyFilterProperties(t, {
    channel: currentWorkspaceChannel,
    isVisibilityEnabled: visibilityGate.enforced,
  });
  const sortOptions = getSurveySortOptions(t);
  const tableState = useTableUrlState({
    properties: filterProperties,
    sortOptions: SURVEY_SORT_VALUES,
    defaultSortBy: DEFAULT_SURVEY_SORT,
  });
  const listFilters = toSurveyListFilters(tableState.filters, tableState.search, tableState.sortBy);
  const listFiltersKey = JSON.stringify(listFilters);
  const normalizedFilters = useMemo(
    () => normalizeSurveyFilters(listFilters ?? initialFilters, currentWorkspaceChannel),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the serialized filters, rebuilt every render
    [listFiltersKey, currentWorkspaceChannel]
  );
  const hasFilters = tableState.filters.length > 0 || tableState.search.trim().length > 0;
  const columnState = useTableColumnState({
    storagePrefix: `${workspace.id}-surveys`,
    columnIds: SURVEY_TABLE_COLUMN_IDS,
  });

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
    workspaceSurveyCount,
    totalCount,
  } = useSurveys({
    workspaceId: workspace.id,
    limit: surveysPerPage,
    filters: normalizedFilters,
    // Filters that exclude every value cannot match anything; there is nothing to ask the API.
    enabled: listFilters !== null,
  });

  const deleteSurveyMutation = useDeleteSurvey({ queryKey });
  const updateSurveyStatusMutation = useUpdateSurveyStatus({ queryKey });
  const archiveSurveyMutation = useArchiveSurvey({ queryKey });
  const restoreSurveyMutation = useRestoreSurvey({ queryKey });
  const renameSurveyMutation = useRenameSurvey({ queryKey });
  const updateSurveyVisibilityMutation = useUpdateSurveyVisibility({ listQueryKey: queryKey });

  // Stable: the Collaborate modal runs it from an effect.
  const { filters: activeFilters, setFilters } = tableState;
  const handleVisibilityNotEnabled = useCallback(() => {
    setIsVisibilityTurnedOff(true);
    if (activeFilters.some((filter) => filter.property === "visibility")) {
      setFilters(activeFilters.filter((filter) => filter.property !== "visibility"));
    }
  }, [activeFilters, setFilters]);

  // The first load keeps the page skeleton; later loads (a filter change) keep the toolbar on screen.
  const showInitialLoading =
    isLoading && surveys.length === 0 && workspaceSurveyCount === null && !hasFilters;
  // Only a workspace without a single survey gets the onboarding empty states. Every other empty
  // list keeps the toolbar, so the filter that emptied it stays reachable.
  const isWorkspaceEmpty = !isError && workspaceSurveyCount === 0;
  const showTemplateEmptyState = isWorkspaceEmpty && !isReadOnly;
  const showReadOnlyEmptyState = isWorkspaceEmpty && isReadOnly;

  const handleDeleteSurvey = async (surveyId: string) => {
    await deleteSurveyMutation.mutateAsync({ surveyId });
  };

  const handleDeleteBlocked = (blockers: TSurveyVisibilityBlocker[]) => {
    setDeleteBlockers(blockers);
    setDeleteBlockedDialogOpen(true);
  };

  const handleUpdateSurveyStatus = async (surveyId: string, status: TSurveyStatus) => {
    await updateSurveyStatusMutation.mutateAsync({ surveyId, status });
  };

  const handleArchiveSurvey = async (surveyId: string) => {
    await archiveSurveyMutation.mutateAsync({ surveyId });
  };

  const handleRestoreSurvey = async (surveyId: string) => {
    await restoreSurveyMutation.mutateAsync({ surveyId });
  };

  const handleRenameSurvey = async (surveyId: string, name: string) => {
    await renameSurveyMutation.mutateAsync({ surveyId, name });
  };

  const handleUpdateSurveyVisibility = async (surveyId: string, visibility: TSurveyVisibility) => {
    await updateSurveyVisibilityMutation.mutateAsync({ surveyId, visibility });
  };

  const createSurveyButton = (
    <NewSurveyMenu
      workspace={workspace}
      language={locale}
      defaultSurveyLanguage={defaultSurveyLanguage}
      isAIAvailable={isAIAvailable}
      aiUnavailableReason={aiUnavailableReason}
    />
  );
  const headerCta = isReadOnly ? <></> : createSurveyButton;

  if (showInitialLoading) {
    return (
      <PageContentWrapper>
        {/* The CTA depends on nothing the query fetches, so it stays live while the list loads —
            someone who came to create a survey should not wait for a list they did not ask for
            (ENG-2579). Same CTA as the loaded state below, so the header does not shift. */}
        <PageHeader pageTitle={t("common.surveys")} cta={headerCta} />
        <SurveyLoading />
      </PageContentWrapper>
    );
  }

  if (showTemplateEmptyState) {
    return (
      <TemplateContainerWithPreview
        workspace={workspace}
        isTemplatePage={false}
        publicDomain={publicDomain}
        defaultLanguage={defaultSurveyLanguage}
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

  const matchCount = listFilters === null ? 0 : totalCount;

  const surveyContent =
    isError && surveys.length === 0 ? (
      <div className="flex w-full flex-col items-center justify-center gap-4 py-16 text-slate-600">
        <p>{getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again"))}</p>
        <Button variant="secondary" size="sm" onClick={() => refetch()}>
          {t("common.try_again")}
        </Button>
      </div>
    ) : (
      <SurveysTable
        surveys={listFilters === null ? NO_SURVEYS : surveys}
        isLoading={listFilters !== null && isLoading && surveys.length === 0}
        hasFilters={hasFilters}
        onClearFilters={tableState.clearFilters}
        hasNextPage={listFilters !== null && Boolean(hasNextPage)}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={() => void fetchNextPage()}
        columnOrder={columnState.columnOrder}
        columnVisibility={columnState.columnVisibility}
        workspaceBasePath={`/workspaces/${workspace.id}`}
        workspaceName={workspace.name}
        publicDomain={publicDomain}
        isReadOnly={isReadOnly}
        locale={locale}
        surveyVisibilityGate={visibilityGate}
        listQueryKey={queryKey}
        deleteSurvey={handleDeleteSurvey}
        updateSurveyStatus={handleUpdateSurveyStatus}
        archiveSurvey={handleArchiveSurvey}
        restoreSurvey={handleRestoreSurvey}
        renameSurvey={handleRenameSurvey}
        updateSurveyVisibility={handleUpdateSurveyVisibility}
        onVisibilityNotEnabled={handleVisibilityNotEnabled}
        onDeleteBlocked={handleDeleteBlocked}
      />
    );

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.surveys")} cta={headerCta} />
      <div className="space-y-6">
        {!isReadOnly && showFeaturedTemplates && (
          <FeaturedTemplates
            workspace={workspace}
            locale={locale}
            isAIAvailable={isAIAvailable}
            aiUnavailableReason={aiUnavailableReason}
          />
        )}
        <div className="space-y-3">
          <TableToolbar
            settings={{
              sort: { options: sortOptions, value: tableState.sortBy, onChange: tableState.setSortBy },
              toggles: [
                {
                  id: "show-archived",
                  label: t("common.table_toolbar.show_archived"),
                  checked: isShowingArchived(tableState.filters),
                  onCheckedChange: (checked) => setFilters(setShowArchived(tableState.filters, checked)),
                },
              ],
              columns: {
                items: buildColumnSettings(
                  getSurveyColumnLabels(t),
                  columnState.columnOrder,
                  columnState.columnVisibility,
                  ["name"]
                ),
                onVisibilityChange: (id, visible) =>
                  columnState.setColumnVisibility((current) => ({ ...current, [id]: visible })),
                onMove: columnState.moveColumn,
              },
            }}
            search={{
              value: tableState.search,
              onChange: tableState.setSearch,
              placeholder: t("workspace.surveys.search_by_survey_name"),
            }}
            filter={{
              properties: filterProperties,
              filters: tableState.filters,
              onFiltersChange: setFilters,
            }}
            matchCount={{ count: matchCount }}
            isLoading={isLoading}
          />
          {surveyContent}
        </div>
      </div>
      <SurveyDeleteBlockedDialog
        open={isDeleteBlockedDialogOpen}
        setOpen={setDeleteBlockedDialogOpen}
        workspaceId={workspace.id}
        blockers={deleteBlockers}
      />
    </PageContentWrapper>
  );
};
