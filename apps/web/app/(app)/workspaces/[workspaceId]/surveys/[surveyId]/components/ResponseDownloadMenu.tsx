"use client";

import * as Sentry from "@sentry/nextjs";
import { DownloadIcon, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TResponseFilterCriteria } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getResponsesDownloadUrlAction } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/actions";
import { downloadResponsesFile } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/utils";
import { getSurveyFileUploadConfigs } from "@/modules/storage/survey-file-upload-elements";
import { Button } from "@/modules/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";

enum FilterDownload {
  ALL = "common.all",
  FILTER = "common.filter",
}

/**
 * Download, as a table toolbar action on Responses and Summary: every response, or the ones the
 * toolbar's filters match, as CSV, Excel or (when the survey collects files) the attachments.
 */
export const ResponseDownloadMenu = ({
  survey,
  getFilters,
}: Readonly<{ survey: TSurvey; getFilters: () => TResponseFilterCriteria }>) => {
  const { t } = useTranslation();
  const [isDownloadDropDownOpen, setIsDownloadDropDownOpen] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  // The attachment items only make sense when the survey actually collects files. Hidden rather than
  // disabled: a survey with no file-upload element has nothing to explain.
  const hasFileUploadElements = useMemo(
    () => getSurveyFileUploadConfigs({ blocks: survey.blocks, questions: survey.questions }).length > 0,
    [survey.blocks, survey.questions]
  );

  /**
   * Attachments are downloaded by navigating to the export route, never by fetch + blob: the archive can
   * reach several GB and buffering it in the tab would kill it.
   *
   * That is also why this pre-flights. Once the route has flushed its 200 and headers it can no longer
   * answer with an error, and a problem document rendered into the tab would replace this page. So ask
   * for the counts first, toast anything the user needs to know, and only then navigate.
   */
  const handleDownloadAttachments = async (filter: FilterDownload) => {
    const buildUrl = (extra?: Record<string, string>) => {
      const params = new URLSearchParams(extra);
      if (filter === FilterDownload.FILTER) {
        params.set("filters", JSON.stringify(getFilters()));
      }
      return `/api/surveys/${survey.id}/attachments?${params.toString()}`;
    };

    // Held from the click until either an error or the navigation, because both phases are slow enough
    // to look like nothing happened: the pre-flight counts every matching file, and the download request
    // then collects them again before the first byte reaches the browser.
    const toastId = toast.loading(t("workspace.surveys.responses.preparing_attachments_download"));

    try {
      setIsDownloading(true);

      const preflight = await fetch(buildUrl({ dryRun: "true" }));
      if (!preflight.ok) {
        toast.error(t("workspace.surveys.responses.error_downloading_attachments"), { id: toastId });
        return;
      }

      const { data } = await preflight.json();

      if (data.exceedsMaxFiles) {
        toast.error(
          t("workspace.surveys.responses.too_many_attachments_to_download", { maxFiles: data.maxFiles }),
          { id: toastId }
        );
        return;
      }

      if (data.fileCount === 0) {
        toast.error(t("workspace.surveys.responses.no_attachments_to_download"), { id: toastId });
        return;
      }

      window.location.assign(buildUrl());

      // A `Content-Disposition: attachment` navigation never unloads this page, so the toast survives to
      // hand over to the browser's own download UI. It says "started" rather than "finished" on purpose:
      // nothing here can observe the archive completing.
      toast.success(
        t("workspace.surveys.responses.attachments_download_started", { fileCount: data.fileCount }),
        { id: toastId, duration: 8000 }
      );
    } catch (err) {
      Sentry.captureException(err);
      toast.error(t("workspace.surveys.responses.error_downloading_attachments"), { id: toastId });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadResponses = async (filter: FilterDownload, fileType: "csv" | "xlsx") => {
    try {
      const responseFilters = filter === FilterDownload.ALL ? {} : getFilters();
      setIsDownloading(true);

      const responsesDownloadUrlResponse = await getResponsesDownloadUrlAction({
        surveyId: survey.id,
        format: fileType,
        filterCriteria: responseFilters,
      });

      if (responsesDownloadUrlResponse?.data) {
        downloadResponsesFile(
          responsesDownloadUrlResponse.data.fileName,
          responsesDownloadUrlResponse.data.fileContents,
          fileType
        );
      } else {
        toast.error(t("workspace.surveys.responses.error_downloading_responses"));
      }
    } catch (err) {
      Sentry.captureException(err);
      toast.error(t("workspace.surveys.responses.error_downloading_responses"));
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <DropdownMenu onOpenChange={setIsDownloadDropDownOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="secondary"
          disabled={isDownloading}
          aria-expanded={isDownloadDropDownOpen}
          data-testid="fb__custom-filter-download">
          {isDownloading ? <Loader2 className="size-4 animate-spin" /> : <DownloadIcon className="size-4" />}
          {t("common.download")}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuItem
          data-testid="fb__custom-filter-download-all-csv"
          onClick={async () => {
            await handleDownloadResponses(FilterDownload.ALL, "csv");
          }}>
          <p className="text-slate-700">{t("workspace.surveys.summary.all_responses_csv")}</p>
        </DropdownMenuItem>
        <DropdownMenuItem
          data-testid="fb__custom-filter-download-all-xlsx"
          onClick={async () => {
            await handleDownloadResponses(FilterDownload.ALL, "xlsx");
          }}>
          <p className="text-slate-700">{t("workspace.surveys.summary.all_responses_excel")}</p>
        </DropdownMenuItem>
        <DropdownMenuItem
          data-testid="fb__custom-filter-download-filtered-csv"
          onClick={async () => {
            await handleDownloadResponses(FilterDownload.FILTER, "csv");
          }}>
          <p className="text-slate-700">{t("workspace.surveys.summary.filtered_responses_csv")}</p>
        </DropdownMenuItem>
        <DropdownMenuItem
          data-testid="fb__custom-filter-download-filtered-xlsx"
          onClick={async () => {
            await handleDownloadResponses(FilterDownload.FILTER, "xlsx");
          }}>
          <p className="text-slate-700">{t("workspace.surveys.summary.filtered_responses_excel")}</p>
        </DropdownMenuItem>
        {hasFileUploadElements && (
          <>
            <DropdownMenuItem
              data-testid="fb__custom-filter-download-all-attachments"
              onClick={async () => {
                await handleDownloadAttachments(FilterDownload.ALL);
              }}>
              <p className="text-slate-700">{t("workspace.surveys.summary.all_responses_attachments")}</p>
            </DropdownMenuItem>
            <DropdownMenuItem
              data-testid="fb__custom-filter-download-filtered-attachments"
              onClick={async () => {
                await handleDownloadAttachments(FilterDownload.FILTER);
              }}>
              <p className="text-slate-700">
                {t("workspace.surveys.summary.filtered_responses_attachments")}
              </p>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
