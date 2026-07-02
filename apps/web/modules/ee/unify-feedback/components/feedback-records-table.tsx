"use client";

import { TFunction } from "i18next";
import {
  CalendarIcon,
  ChevronDownIcon,
  HashIcon,
  LanguagesIcon,
  MessageSquareTextIcon,
  PlusIcon,
  RefreshCwIcon,
  ToggleLeftIcon,
  TypeIcon,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getLanguageLabel } from "@formbricks/i18n-utils/src/utils";
import type { TFeedbackSourceFieldMapping } from "@formbricks/types/feedback-source";
import { listFeedbackRecordsAction } from "@/lib/feedback-source/actions";
import { formatDateForDisplay, formatDateTimeForDisplay } from "@/lib/utils/datetime";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import type { FeedbackRecordData } from "@/modules/hub/types";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { Checkbox } from "@/modules/ui/components/checkbox";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";
import { deleteFeedbackRecordAction, resolveSurveyWorkspaceAction } from "../actions";
import { formatSourceType, resolveFeedbackDisplayText, toISOOrUndefined } from "../lib/utils";
import { CsvImportModal } from "../sources/components/csv-import-modal";
import { FeedbackRecordFormDrawer } from "./feedback-record-form-drawer";
import { FeedbackRecordsTableToolbarLeft } from "./feedback-records-table-toolbar-left";

const RECORDS_PER_PAGE = 50;

// Sentinel for the "All sources" option — a radix Select item can't have an empty-string value.
const ALL_SOURCES_VALUE = "__all__";

const FIELD_TYPE_ICONS: Record<string, React.ReactNode> = {
  text: <TypeIcon className="size-3.5" />,
  categorical: <HashIcon className="size-3.5" />,
  nps: <HashIcon className="size-3.5" />,
  csat: <HashIcon className="size-3.5" />,
  ces: <HashIcon className="size-3.5" />,
  rating: <HashIcon className="size-3.5" />,
  number: <HashIcon className="size-3.5" />,
  boolean: <ToggleLeftIcon className="size-3.5" />,
  date: <CalendarIcon className="size-3.5" />,
};

// Resolution of a Formbricks survey source_id to its owning workspace and whether the viewer can
// reach it. Precomputed for the SSR page and lazily filled for load-more rows (decision #6).
type SurveyWorkspaceResolution = { workspaceId: string | null; accessible: boolean };
export type SurveyWorkspaceMap = Record<string, SurveyWorkspaceResolution>;

// resolvedText (translation-preferred) is computed once by the caller; null falls through to other types.
const formatValue = (
  record: FeedbackRecordData,
  resolvedText: string | null,
  t: TFunction,
  locale: string
): string => {
  if (resolvedText != null) return resolvedText;
  if (record.value_number != null) return String(record.value_number);
  if (record.value_boolean != null) return record.value_boolean ? t("common.yes") : t("common.no");
  if (record.value_date != null) return formatDateForDisplay(new Date(record.value_date), locale);
  return "—";
};

const isFormbricksSurveyRecord = (record: FeedbackRecordData): boolean =>
  (record.source_type === "formbricks" || record.source_type === "formbricks_survey") && !!record.source_id;

// CSV source assigned to the dataset; `workspaceId` scopes the (still workspace-bound) CSV upload.
interface CsvSource {
  id: string;
  name: string;
  fieldMappings: TFeedbackSourceFieldMapping[];
  workspaceId: string;
}

interface FeedbackRecordsTableProps {
  organizationId: string;
  // Single dataset (Hub tenant) in view; the selector lives one level up in the page client.
  datasetId: string;
  datasetName: string;
  initialRecords: FeedbackRecordData[];
  initialCursor: string | null;
  // Distinct source types present in the dataset, used to populate the Source filter.
  sourceOptions: { sourceType: string }[];
  csvSources: CsvSource[];
  canWrite: boolean;
  // source_id -> owning workspace resolution, precomputed on the server for the initial page.
  surveyWorkspaceMap: SurveyWorkspaceMap;
}

interface FeedbackRecordRowProps {
  record: FeedbackRecordData;
  surveyResolution: SurveyWorkspaceResolution | undefined;
  locale: string;
  t: TFunction;
  isSelected: boolean;
  onSelectChange: (checked: boolean) => void;
  onClick: () => void;
}

export const FeedbackRecordsTable = ({
  organizationId,
  datasetId,
  datasetName,
  initialRecords,
  initialCursor,
  sourceOptions,
  csvSources,
  canWrite,
  surveyWorkspaceMap,
}: Readonly<FeedbackRecordsTableProps>) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  const [records, setRecords] = useState<FeedbackRecordData[]>(initialRecords);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("edit");
  const [drawerRecordId, setDrawerRecordId] = useState<string | undefined>();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [csvImportSource, setCsvImportSource] = useState<CsvSource | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filters (Hub-side): a single source_type plus a collected_at range. Empty means unfiltered.
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [sinceFilter, setSinceFilter] = useState<string>("");
  const [untilFilter, setUntilFilter] = useState<string>("");

  // Locally-resolved survey workspace map, seeded from the server precomputation and extended for
  // load-more rows. Kept in state so newly-resolved rows re-render as links.
  const [surveyResolutions, setSurveyResolutions] = useState<SurveyWorkspaceMap>(surveyWorkspaceMap);

  const hasMore = cursor !== null;
  const selectedCount = selectedIds.size;
  const allOnPageSelected = records.length > 0 && records.every((record) => selectedIds.has(record.id));
  const someOnPageSelected = records.some((record) => selectedIds.has(record.id));
  const hasActiveFilters = sourceFilter !== "" || sinceFilter !== "" || untilFilter !== "";

  const toggleAllOnPage = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        records.forEach((record) => next.add(record.id));
      } else {
        records.forEach((record) => next.delete(record.id));
      }
      return next;
    });
  };

  const toggleOne = (recordId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(recordId);
      } else {
        next.delete(recordId);
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  type FetchResult =
    | { ok: true; records: FeedbackRecordData[]; nextCursor: string | null }
    | { ok: false; errorMessage: string };

  // Single-tenant fetch. "refresh" restarts from the first page with the current filters; "loadMore"
  // continues from the stored cursor. Filter overrides let a filter change fetch immediately without
  // waiting for the state update to flush.
  const fetchRecords = useCallback(
    async (
      mode: "refresh" | "loadMore",
      filterOverrides?: { source?: string; since?: string; until?: string }
    ): Promise<FetchResult> => {
      const source = filterOverrides?.source ?? sourceFilter;
      const since = filterOverrides?.since ?? sinceFilter;
      const until = filterOverrides?.until ?? untilFilter;

      const result = await listFeedbackRecordsAction({
        organizationId,
        directoryId: datasetId,
        limit: RECORDS_PER_PAGE,
        ...(mode === "loadMore" && cursor ? { cursor } : {}),
        ...(source ? { sourceType: source } : {}),
        ...(toISOOrUndefined(since) ? { since: toISOOrUndefined(since) } : {}),
        ...(toISOOrUndefined(until) ? { until: toISOOrUndefined(until) } : {}),
      });

      if (!result?.data) {
        return {
          ok: false,
          errorMessage:
            getFormattedErrorMessage(result) ?? t("workspace.unify.failed_to_load_feedback_records"),
        };
      }

      return { ok: true, records: result.data.data, nextCursor: result.data.next_cursor ?? null };
    },
    [organizationId, datasetId, cursor, sourceFilter, sinceFilter, untilFilter, t]
  );

  const applyRefreshResult = (result: Extract<FetchResult, { ok: true }>) => {
    const sorted = result.records.toSorted((a, b) => (a.collected_at < b.collected_at ? 1 : -1));
    setRecords(sorted);
    setCursor(result.nextCursor);
    setSelectedIds(new Set());
  };

  const handleRefresh = async () => {
    if (isRefreshing || isLoadingMore) return;
    setIsRefreshing(true);
    setError(null);

    const toastId = toast.loading(t("workspace.unify.refreshing_feedback_records"));
    const result = await fetchRecords("refresh");

    if (!result.ok) {
      toast.error(result.errorMessage, { id: toastId });
      setIsRefreshing(false);
      return;
    }

    applyRefreshResult(result);
    setIsRefreshing(false);
    toast.success(t("workspace.unify.feedback_records_refreshed"), { id: toastId });
  };

  // Silent reload (no toast) used when a filter changes. Fetches immediately with the new filter set.
  const reloadWithFilters = async (overrides: { source?: string; since?: string; until?: string }) => {
    if (isRefreshing || isLoadingMore) return;
    setIsRefreshing(true);
    setError(null);

    const result = await fetchRecords("refresh", overrides);
    if (!result.ok) {
      setError(result.errorMessage);
      setIsRefreshing(false);
      return;
    }

    applyRefreshResult(result);
    setIsRefreshing(false);
  };

  const handleLoadMore = async () => {
    if (isLoadingMore || isRefreshing || !hasMore) return;
    setIsLoadingMore(true);

    const result = await fetchRecords("loadMore");

    if (!result.ok) {
      toast.error(result.errorMessage);
      setIsLoadingMore(false);
      return;
    }

    setRecords((prev) =>
      [...prev, ...result.records].toSorted((a, b) => (a.collected_at < b.collected_at ? 1 : -1))
    );
    setCursor(result.nextCursor);
    setIsLoadingMore(false);
  };

  const handleSourceFilterChange = (value: string) => {
    const nextSource = value === ALL_SOURCES_VALUE ? "" : value;
    setSourceFilter(nextSource);
    void reloadWithFilters({ source: nextSource });
  };

  const handleSinceChange = (value: string) => {
    setSinceFilter(value);
    void reloadWithFilters({ since: value });
  };

  const handleUntilChange = (value: string) => {
    setUntilFilter(value);
    void reloadWithFilters({ until: value });
  };

  const clearFilters = () => {
    setSourceFilter("");
    setSinceFilter("");
    setUntilFilter("");
    void reloadWithFilters({ source: "", since: "", until: "" });
  };

  // Lazily resolve survey workspaces for any Formbricks rows not already in the map (e.g. load-more
  // rows). Unresolved rows render as plain text until this fills them in.
  useEffect(() => {
    const unresolvedSourceIds = Array.from(
      new Set(
        records
          .filter((record) => isFormbricksSurveyRecord(record))
          .map((record) => record.source_id as string)
          .filter((sourceId) => !(sourceId in surveyResolutions))
      )
    );
    if (unresolvedSourceIds.length === 0) return;

    let cancelled = false;
    void (async () => {
      const resolved = await Promise.all(
        unresolvedSourceIds.map(async (sourceId) => {
          const result = await resolveSurveyWorkspaceAction({ organizationId, surveyId: sourceId });
          return [sourceId, result?.data ?? { workspaceId: null, accessible: false }] as const;
        })
      );
      if (cancelled) return;
      setSurveyResolutions((prev) => {
        const next = { ...prev };
        for (const [sourceId, resolution] of resolved) {
          next[sourceId] = resolution;
        }
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [records, surveyResolutions, organizationId]);

  if (error) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="flex h-48 flex-col items-center justify-center gap-3 px-4 text-center">
          <MessageSquareTextIcon className="size-8 text-slate-400" />
          <p className="text-sm text-slate-500">{error}</p>
          <Button variant="secondary" size="sm" onClick={handleRefresh}>
            {t("common.retry")}
          </Button>
        </div>
      </div>
    );
  }

  const isEmpty = records.length === 0 && !isRefreshing;

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setIsDeleting(true);
    const CHUNK_SIZE = 5;
    const failedIds: string[] = [];
    try {
      for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        const chunk = ids.slice(i, i + CHUNK_SIZE);
        const results = await Promise.all(
          chunk.map(async (recordId) => ({
            recordId,
            result: await deleteFeedbackRecordAction({ organizationId, directoryId: datasetId, recordId }),
          }))
        );
        results.forEach(({ recordId, result }) => {
          if (!result?.data) failedIds.push(recordId);
        });
      }

      const succeeded = ids.filter((id) => !failedIds.includes(id));
      if (succeeded.length > 0) {
        setRecords((prev) => prev.filter((record) => !succeeded.includes(record.id)));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          succeeded.forEach((id) => next.delete(id));
          return next;
        });
      }

      if (failedIds.length === 0) {
        toast.success(
          t("workspace.unify.feedback_records_deleted_successfully", { count: succeeded.length })
        );
      } else if (succeeded.length === 0) {
        toast.error(t("workspace.unify.failed_to_delete_feedback_records"));
      } else {
        toast.error(
          t("workspace.unify.feedback_records_partially_deleted", {
            succeeded: succeeded.length,
            total: ids.length,
          })
        );
      }
    } finally {
      setIsDeleting(false);
      setIsBulkDeleteDialogOpen(false);
    }
  };

  const openEditDrawer = (recordId: string) => {
    setDrawerMode("edit");
    setDrawerRecordId(recordId);
    setIsDrawerOpen(true);
  };

  const openCreateDrawer = () => {
    setDrawerMode("create");
    setDrawerRecordId(undefined);
    setIsDrawerOpen(true);
  };

  const hasCsvSources = csvSources.length > 0;

  let headerCheckboxChecked: boolean | "indeterminate" = false;
  if (allOnPageSelected) {
    headerCheckboxChecked = true;
  } else if (someOnPageSelected) {
    headerCheckboxChecked = "indeterminate";
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="source-filter">{t("workspace.unify.filter_by_source")}</Label>
              <Select
                value={sourceFilter === "" ? ALL_SOURCES_VALUE : sourceFilter}
                onValueChange={handleSourceFilterChange}>
                <SelectTrigger id="source-filter" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_SOURCES_VALUE}>{t("workspace.unify.filter_all_sources")}</SelectItem>
                  {sourceOptions.map((option) => (
                    <SelectItem key={option.sourceType} value={option.sourceType}>
                      {formatSourceType(option.sourceType, t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="since-filter">{t("workspace.unify.filter_from_date")}</Label>
              <Input
                id="since-filter"
                type="datetime-local"
                className="w-52"
                value={sinceFilter}
                onChange={(event) => handleSinceChange(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="until-filter">{t("workspace.unify.filter_to_date")}</Label>
              <Input
                id="until-filter"
                type="datetime-local"
                className="w-52"
                value={untilFilter}
                onChange={(event) => handleUntilChange(event.target.value)}
              />
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                {t("workspace.unify.clear_filters")}
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <FeedbackRecordsTableToolbarLeft
            selectedCount={selectedCount}
            recordsCount={records.length}
            isEmpty={isEmpty}
            onClearSelection={clearSelection}
            onBulkDelete={() => setIsBulkDeleteDialogOpen(true)}
          />
          <div className="flex items-center gap-2">
            {canWrite &&
              (hasCsvSources ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="secondary">
                      <PlusIcon className="size-4" />
                      {t("workspace.unify.add_feedback_record")}
                      <ChevronDownIcon className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={openCreateDrawer}>
                      {t("workspace.unify.add_feedback_record")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {csvSources.map((source) => (
                      <DropdownMenuItem
                        key={source.id}
                        onClick={() => {
                          setCsvImportSource(source);
                        }}>
                        {t("workspace.unify.import_via_source_name", { sourceName: source.name })}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button size="sm" variant="secondary" onClick={openCreateDrawer}>
                  <PlusIcon className="size-4" />
                  {t("workspace.unify.add_feedback_record")}
                </Button>
              ))}
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing || isLoadingMore}
              aria-label={t("workspace.unify.refresh_feedback_records")}>
              <RefreshCwIcon className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] table-fixed">
              <colgroup>
                <col className="w-10" />
                <col className="w-40" />
                <col className="w-32" />
                <col className="w-40" />
                <col className="w-52" />
                <col className="w-28" />
                <col />
                <col className="w-44" />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-200 text-left text-sm text-slate-900 [&>th]:font-semibold">
                  <th className="w-10 px-4 py-3">
                    <Checkbox
                      aria-label={t("common.select_all")}
                      checked={headerCheckboxChecked}
                      onCheckedChange={(checked) => toggleAllOnPage(checked === true)}
                    />
                  </th>
                  <th className="px-4 py-3 whitespace-nowrap">{t("workspace.unify.collected_at")}</th>
                  <th className="px-4 py-3 whitespace-nowrap">{t("workspace.unify.source_type")}</th>
                  <th className="px-4 py-3 whitespace-nowrap">{t("workspace.unify.source_name")}</th>
                  <th className="px-4 py-3 whitespace-nowrap">{t("workspace.unify.field_label")}</th>
                  <th className="px-4 py-3 whitespace-nowrap">{t("workspace.unify.field_type")}</th>
                  <th className="px-4 py-3 whitespace-nowrap">{t("workspace.unify.value")}</th>
                  <th className="px-4 py-3 whitespace-nowrap">{t("workspace.unify.user_identifier")}</th>
                </tr>
              </thead>
              {isEmpty ? (
                <tbody>
                  <tr>
                    <td colSpan={8}>
                      <div className="flex h-32 items-center justify-center">
                        <p className="text-sm text-slate-500">{t("workspace.unify.no_feedback_records")}</p>
                      </div>
                    </td>
                  </tr>
                </tbody>
              ) : (
                <tbody className="divide-y divide-slate-100">
                  {records.map((record) => (
                    <FeedbackRecordRow
                      key={record.id}
                      record={record}
                      surveyResolution={record.source_id ? surveyResolutions[record.source_id] : undefined}
                      locale={locale}
                      t={t}
                      isSelected={selectedIds.has(record.id)}
                      onSelectChange={(checked) => toggleOne(record.id, checked)}
                      onClick={() => openEditDrawer(record.id)}
                    />
                  ))}
                </tbody>
              )}
            </table>
          </div>
        </div>

        {hasMore && (
          <div className="flex justify-center">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleLoadMore}
              disabled={isLoadingMore || isRefreshing}
              loading={isLoadingMore}>
              {t("common.load_more")}
            </Button>
          </div>
        )}
      </div>

      <FeedbackRecordFormDrawer
        mode={drawerMode}
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        organizationId={organizationId}
        datasetId={datasetId}
        datasetName={datasetName}
        canWrite={canWrite}
        recordId={drawerMode === "edit" ? drawerRecordId : undefined}
        onSuccess={handleRefresh}
      />

      <DeleteDialog
        open={isBulkDeleteDialogOpen}
        setOpen={setIsBulkDeleteDialogOpen}
        deleteWhat={t("workspace.unify.feedback_records")}
        text={t("workspace.unify.delete_feedback_records_confirmation", { count: selectedCount })}
        onDelete={handleBulkDelete}
        isDeleting={isDeleting}
      />

      {csvImportSource && (
        <CsvImportModal
          open={csvImportSource !== null}
          onOpenChange={(open) => {
            if (!open) {
              setCsvImportSource(null);
            }
          }}
          feedbackSourceId={csvImportSource.id}
          workspaceId={csvImportSource.workspaceId}
          fieldMappings={csvImportSource.fieldMappings}
        />
      )}
    </>
  );
};

const FeedbackRecordRow = ({
  record,
  surveyResolution,
  locale,
  t,
  isSelected,
  onSelectChange,
  onClick,
}: Readonly<FeedbackRecordRowProps>) => {
  const { text, isTranslated, original, langKey } = resolveFeedbackDisplayText(record);
  const value = formatValue(record, text, t, locale);
  const isLongValue = value.length > 60;
  const translatedLangLabel = langKey ? (getLanguageLabel(langKey, locale) ?? langKey) : null;
  const collectedAt = formatDateTimeForDisplay(new Date(record.collected_at), locale);
  // Link only a Formbricks survey source whose owning workspace the viewer can reach (decision #6);
  // otherwise the source name is plain, non-clickable text.
  const surveyLinkWorkspaceId =
    isFormbricksSurveyRecord(record) && surveyResolution?.accessible ? surveyResolution.workspaceId : null;
  const surveySummaryHref = surveyLinkWorkspaceId
    ? `/workspaces/${surveyLinkWorkspaceId}/surveys/${record.source_id}/summary`
    : null;

  return (
    <tr
      className={`cursor-pointer text-sm text-slate-700 transition-colors focus-within:bg-slate-50 hover:bg-slate-50 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-400 ${isSelected ? "bg-slate-50" : ""}`}
      tabIndex={0}
      aria-label={record.field_label ?? record.field_id}
      aria-selected={isSelected}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}>
      <td
        className="w-10 px-4 py-3"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}>
        <Checkbox
          aria-label={record.field_label ?? record.field_id}
          checked={isSelected}
          onCheckedChange={(checked) => onSelectChange(checked === true)}
        />
      </td>
      <td className="px-4 py-3 text-slate-500" title={collectedAt}>
        <span className="block min-w-0 truncate">{collectedAt}</span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <Badge text={formatSourceType(record.source_type, t)} type="gray" size="tiny" />
      </td>
      <td className="px-4 py-3" title={record.source_name ?? undefined}>
        {surveySummaryHref ? (
          <Link
            href={surveySummaryHref}
            className="block min-w-0 truncate text-slate-700 underline underline-offset-2 hover:text-slate-900"
            onClick={(event) => event.stopPropagation()}>
            {record.source_name ?? "—"}
          </Link>
        ) : (
          <span className="block min-w-0 truncate">{record.source_name ?? "—"}</span>
        )}
      </td>
      <td className="px-4 py-3" title={record.field_label ?? undefined}>
        <span className="block min-w-0 truncate">{record.field_label ?? record.field_id}</span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="inline-flex items-center gap-1 text-slate-600">
          {FIELD_TYPE_ICONS[record.field_type] ?? <HashIcon className="size-3.5" />}
          {record.field_type}
        </span>
      </td>
      <td className="px-4 py-3" title={value}>
        <div className="flex min-w-0 items-center gap-1.5">
          {isLongValue ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="block min-w-0 cursor-default truncate">{value}</span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-sm whitespace-pre-wrap">
                  {value}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <span className="block min-w-0 truncate">{value}</span>
          )}
          {isTranslated && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-auto shrink-0 cursor-default gap-1 px-1.5 py-0.5 text-xs font-normal [&_svg]:size-3"
                    aria-label={
                      translatedLangLabel
                        ? `${t("workspace.unify.translated")}: ${translatedLangLabel}`
                        : t("workspace.unify.translated")
                    }
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}>
                    <LanguagesIcon aria-hidden="true" />
                    {translatedLangLabel ?? t("workspace.unify.translated")}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-sm whitespace-pre-wrap">
                  <span className="font-medium">{t("workspace.unify.original_text")}: </span>
                  {original ?? "—"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-slate-500" title={record.user_id}>
        <span className="block min-w-0 truncate">{record.user_id ?? "—"}</span>
      </td>
    </tr>
  );
};
