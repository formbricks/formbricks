"use client";

import { TFunction } from "i18next";
import {
  CalendarIcon,
  ChevronDownIcon,
  HashIcon,
  MessageSquareTextIcon,
  PlusIcon,
  RefreshCwIcon,
  ToggleLeftIcon,
  TypeIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { listFeedbackRecordsAction } from "@/lib/connector/actions";
import { formatDateForDisplay, formatDateTimeForDisplay } from "@/lib/utils/datetime";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import type { FeedbackRecordData } from "@/modules/hub/types";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";
import { CsvImportModal } from "../../sources/components/csv-import-modal";
import { formatSourceType } from "../lib/utils";
import { FeedbackRecordFormDrawer } from "./feedback-record-form-drawer";

const RECORDS_PER_PAGE = 50;

const FIELD_TYPE_ICONS: Record<string, React.ReactNode> = {
  text: <TypeIcon className="h-3.5 w-3.5" />,
  categorical: <HashIcon className="h-3.5 w-3.5" />,
  nps: <HashIcon className="h-3.5 w-3.5" />,
  csat: <HashIcon className="h-3.5 w-3.5" />,
  ces: <HashIcon className="h-3.5 w-3.5" />,
  rating: <HashIcon className="h-3.5 w-3.5" />,
  number: <HashIcon className="h-3.5 w-3.5" />,
  boolean: <ToggleLeftIcon className="h-3.5 w-3.5" />,
  date: <CalendarIcon className="h-3.5 w-3.5" />,
};

const formatValue = (record: FeedbackRecordData, t: TFunction, locale: string): string => {
  if (record.value_text != null) return record.value_text;
  if (record.value_number != null) return String(record.value_number);
  if (record.value_boolean != null) return record.value_boolean ? t("common.yes") : t("common.no");
  if (record.value_date != null) return formatDateForDisplay(new Date(record.value_date), locale);
  return "—";
};

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "…";
}

interface FeedbackRecordsTableProps {
  workspaceId: string;
  initialRecords: FeedbackRecordData[];
  frdMap: Record<string, string>;
  csvSources: { id: string; name: string }[];
  canWrite: boolean;
}

export const FeedbackRecordsTable = ({
  workspaceId,
  initialRecords,
  frdMap,
  csvSources,
  canWrite,
}: Readonly<FeedbackRecordsTableProps>) => {
  const { t, i18n } = useTranslation();
  const [records, setRecords] = useState<FeedbackRecordData[]>(initialRecords);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("edit");
  const [drawerRecordId, setDrawerRecordId] = useState<string | undefined>();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [csvImportSource, setCsvImportSource] = useState<{ id: string; name: string } | null>(null);

  const directories = useMemo(
    () =>
      Object.entries(frdMap)
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [frdMap]
  );
  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setError(null);

    const toastId = toast.loading(t("workspace.unify.refreshing_feedback_records"));
    const directoryIds = Object.keys(frdMap);
    const results = await Promise.all(
      directoryIds.map((frdId) =>
        listFeedbackRecordsAction({
          workspaceId,
          frdId,
          limit: RECORDS_PER_PAGE,
        })
      )
    );

    const successfulRecords = results.flatMap((result) => result?.data?.data ?? []);

    if (directoryIds.length > 0 && successfulRecords.length === 0) {
      const firstErrorResult = results.find((result) => !result?.data);
      const errorMessage = firstErrorResult ? getFormattedErrorMessage(firstErrorResult) : undefined;
      toast.error(errorMessage ?? t("workspace.unify.failed_to_load_feedback_records"), {
        id: toastId,
      });
      setIsRefreshing(false);
      return;
    }

    const mergedRecords = successfulRecords
      .toSorted((a, b) => (a.collected_at < b.collected_at ? 1 : -1))
      .slice(0, RECORDS_PER_PAGE);
    setRecords(mergedRecords);
    setIsRefreshing(false);
    toast.success(t("workspace.unify.feedback_records_refreshed"), { id: toastId });
  };

  if (error) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex h-48 flex-col items-center justify-center gap-3 px-4 text-center">
          <MessageSquareTextIcon className="h-8 w-8 text-slate-400" />
          <p className="text-sm text-slate-500">{error}</p>
          <Button variant="secondary" size="sm" onClick={handleRefresh}>
            {t("common.retry")}
          </Button>
        </div>
      </div>
    );
  }

  const isEmpty = records.length === 0 && !isRefreshing;

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

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          {isEmpty ? (
            <span />
          ) : (
            <p className="text-sm text-slate-500">
              {t("workspace.unify.showing_count_loaded", {
                count: records.length,
              })}
            </p>
          )}
          <div className="flex items-center gap-2">
            {canWrite &&
              (hasCsvSources ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="secondary">
                      <PlusIcon className="h-4 w-4" />
                      {t("workspace.unify.add_feedback_record")}
                      <ChevronDownIcon className="h-4 w-4" />
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
                  <PlusIcon className="h-4 w-4" />
                  {t("workspace.unify.add_feedback_record")}
                </Button>
              ))}
            <Button size="sm" asChild>
              <Link href={`/workspaces/${workspaceId}/feedback-sources`}>
                {t("workspace.unify.manage_feedback_sources")}
              </Link>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              aria-label={t("workspace.unify.refresh_feedback_records")}>
              <RefreshCwIcon className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-200 text-left text-sm text-slate-900 [&>th]:font-semibold">
                  <th className="whitespace-nowrap px-4 py-3">{t("workspace.unify.collected_at")}</th>
                  <th className="whitespace-nowrap px-4 py-3">{t("workspace.unify.source_type")}</th>
                  <th className="whitespace-nowrap px-4 py-3">{t("workspace.unify.source_name")}</th>
                  <th className="whitespace-nowrap px-4 py-3">{t("workspace.unify.field_label")}</th>
                  <th className="whitespace-nowrap px-4 py-3">{t("workspace.unify.field_type")}</th>
                  <th className="whitespace-nowrap px-4 py-3">{t("workspace.unify.value")}</th>
                  <th className="whitespace-nowrap px-4 py-3">{t("workspace.unify.user_identifier")}</th>
                </tr>
              </thead>
              {isEmpty ? (
                <tbody>
                  <tr>
                    <td colSpan={7}>
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
                      workspaceId={workspaceId}
                      locale={i18n.resolvedLanguage ?? i18n.language ?? "en-US"}
                      t={t}
                      onClick={() => openEditDrawer(record.id)}
                    />
                  ))}
                </tbody>
              )}
            </table>
          </div>
        </div>
      </div>

      <FeedbackRecordFormDrawer
        mode={drawerMode}
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        workspaceId={workspaceId}
        directories={directories}
        canWrite={canWrite}
        recordId={drawerMode === "edit" ? drawerRecordId : undefined}
        onSuccess={handleRefresh}
      />

      {csvImportSource && (
        <CsvImportModal
          open={csvImportSource !== null}
          onOpenChange={(open) => {
            if (!open) {
              setCsvImportSource(null);
            }
          }}
          connectorId={csvImportSource.id}
          workspaceId={workspaceId}
        />
      )}
    </>
  );
};

const FeedbackRecordRow = ({
  record,
  workspaceId,
  locale,
  t,
  onClick,
}: {
  record: FeedbackRecordData;
  workspaceId: string;
  locale: string;
  t: TFunction;
  onClick: () => void;
}) => {
  const value = formatValue(record, t, locale);
  const isLongValue = value.length > 60;
  const isFormbricksSurveySource =
    (record.source_type === "formbricks" || record.source_type === "formbricks_survey") && !!record.source_id;
  const surveySummaryHref = `/workspaces/${workspaceId}/surveys/${record.source_id}/summary`;

  return (
    <tr
      className="cursor-pointer text-sm text-slate-700 transition-colors hover:bg-slate-50"
      onClick={onClick}>
      <td className="whitespace-nowrap px-4 py-3 text-slate-500">
        {formatDateTimeForDisplay(new Date(record.collected_at), locale)}
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <Badge text={formatSourceType(record.source_type, t)} type="gray" size="tiny" />
      </td>
      <td className="max-w-[150px] truncate px-4 py-3" title={record.source_name ?? undefined}>
        {isFormbricksSurveySource ? (
          <Link
            href={surveySummaryHref}
            className="text-slate-700 underline underline-offset-2 hover:text-slate-900"
            onClick={(event) => event.stopPropagation()}>
            {record.source_name ?? "—"}
          </Link>
        ) : (
          <span>{record.source_name ?? "—"}</span>
        )}
      </td>
      <td className="max-w-[200px] truncate px-4 py-3" title={record.field_label ?? undefined}>
        {record.field_label ?? record.field_id}
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <span className="inline-flex items-center gap-1 text-slate-600">
          {FIELD_TYPE_ICONS[record.field_type] ?? <HashIcon className="h-3.5 w-3.5" />}
          {record.field_type}
        </span>
      </td>
      <td className="max-w-[250px] px-4 py-3">
        {isLongValue ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-default truncate">{truncate(value, 60)}</span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-sm whitespace-pre-wrap">
                {value}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <span>{value}</span>
        )}
      </td>
      <td className="max-w-[120px] truncate px-4 py-3 text-slate-500" title={record.user_identifier}>
        {record.user_identifier ?? "—"}
      </td>
    </tr>
  );
};
