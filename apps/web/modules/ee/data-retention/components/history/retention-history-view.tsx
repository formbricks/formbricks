"use client";

import type { TFunction } from "i18next";
import { DownloadIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { Label } from "@/modules/ui/components/label";
import { SettingsTable, type TSettingsTableColumn } from "@/modules/ui/components/settings-table";
import { Switch } from "@/modules/ui/components/switch";
import { useDownloadRetentionExport, useRetentionRuns } from "../../hooks/use-retention-runs";
import {
  createRetentionCountFormatter,
  formatRetentionDate,
  getRetentionHistoryCounts,
  getRetentionPolicyLabel,
} from "../../lib/display";
import { getRetentionErrorMessage } from "../../lib/error-message";
import type { TRetentionRun } from "../../types";

const PAGE_SIZE = 25;
const HIDE_EMPTY_SWITCH_ID = "retention-history-hide-empty";

const getHistoryColumns = (
  t: TFunction,
  formatRunDate: (iso: string) => string,
  formatCount: (value: number | null) => string
): TSettingsTableColumn<TRetentionRun>[] => [
  {
    id: "run",
    header: t("workspace.settings.data_retention.run"),
    cellClassName: "font-medium text-slate-900",
    cell: (run) => formatRunDate(run.startedAt),
  },
  {
    id: "policy",
    header: t("workspace.settings.data_retention.policy"),
    cell: (run) => getRetentionPolicyLabel(run.policy, t),
  },
  {
    id: "notified",
    header: t("workspace.settings.data_retention.notified"),
    headerClassName: "w-28",
    align: "right",
    cell: (run) => formatCount(getRetentionHistoryCounts(run).notified),
  },
  {
    id: "archived",
    header: t("common.archived"),
    headerClassName: "w-28",
    align: "right",
    cell: (run) => formatCount(getRetentionHistoryCounts(run).archived),
  },
  {
    id: "deleted",
    header: t("workspace.settings.data_retention.deleted_or_deactivated"),
    headerClassName: "w-48",
    align: "right",
    cell: (run) => formatCount(getRetentionHistoryCounts(run).deletedOrDeactivated),
  },
];

interface RetentionHistoryViewProps {
  organizationId: string;
  /** The organization's display time zone, so a night's run shows on the day it ran there. */
  timeZone: string;
}

/** The History tab: what each nightly run did, newest first. */
export const RetentionHistoryView = ({ organizationId, timeZone }: Readonly<RetentionHistoryViewProps>) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  const [hideEmpty, setHideEmpty] = useState(true);

  const {
    runs,
    error,
    isError,
    isLoading,
    isFetching,
    isFetchingNextPage,
    isFetchNextPageError,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useRetentionRuns({ organizationId, includeEmpty: !hideEmpty, limit: PAGE_SIZE });
  const downloadExport = useDownloadRetentionExport({ organizationId });

  const formatCount = createRetentionCountFormatter(locale);
  const formatRunDate = (iso: string) => formatRetentionDate(iso, locale, timeZone);

  const errorMessage = getRetentionErrorMessage(
    error,
    t,
    t("workspace.settings.data_retention.history_load_error")
  );

  const download = () =>
    downloadExport.mutate(undefined, {
      onError: (downloadError) =>
        toast.error(
          getRetentionErrorMessage(
            downloadError,
            t,
            t("workspace.settings.data_retention.history_download_failed")
          )
        ),
    });

  return (
    <SettingsCard
      title={t("workspace.settings.data_retention.history")}
      description={t("workspace.settings.data_retention.history_description")}
      bodyVariant="flush"
      cta={
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-x-2">
            <Switch id={HIDE_EMPTY_SWITCH_ID} checked={hideEmpty} onCheckedChange={setHideEmpty} />
            <Label htmlFor={HIDE_EMPTY_SWITCH_ID}>
              {t("workspace.settings.data_retention.hide_runs_with_no_changes")}
            </Label>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={downloadExport.isPending}
            onClick={download}>
            <DownloadIcon />
            {t("workspace.settings.data_retention.download_csv")}
          </Button>
        </div>
      }>
      {isError && runs.length === 0 ? (
        <div className="p-4">
          <Alert variant="error">
            <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
              {errorMessage}
              <Button variant="secondary" size="sm" onClick={() => refetch()}>
                {t("common.try_again")}
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      ) : (
        <SettingsTable
          aria-label={t("workspace.settings.data_retention.history")}
          data-testid="retention-history-table"
          columns={getHistoryColumns(t, formatRunDate, formatCount)}
          rows={runs}
          getRowId={(run) => run.id}
          emptyMessage={
            hideEmpty
              ? t("workspace.settings.data_retention.no_runs_with_changes")
              : t("workspace.settings.data_retention.no_runs")
          }
          isLoading={isLoading}
          className={isFetching && !isLoading && !isFetchingNextPage ? "opacity-60" : undefined}
          footer={
            hasNextPage ? (
              <div className="flex flex-col items-center gap-2 border-t border-slate-100 py-4">
                {isFetchNextPageError ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
                <Button
                  variant="secondary"
                  size="sm"
                  loading={isFetchingNextPage}
                  onClick={() => fetchNextPage()}>
                  {t("common.load_more")}
                </Button>
              </div>
            ) : undefined
          }
        />
      )}
    </SettingsCard>
  );
};
