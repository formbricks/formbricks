"use client";

import * as Sentry from "@sentry/nextjs";
import { DownloadIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TResponseFilterCriteria } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { ExportModal } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/components/export-modal";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { MAX_ATTACHMENT_FILES } from "@/modules/storage/attachment-export/constants";
import {
  useAttachmentExports,
  useCreateAttachmentExport,
} from "@/modules/storage/attachment-export/hooks/use-attachment-exports";
import { getAttachmentExportDownloadUrl } from "@/modules/storage/attachment-export/lib/api-client";
import { findNewlySettledExports, formatArchiveSize } from "@/modules/storage/attachment-export/lib/query";
import type { TAttachmentExport } from "@/modules/storage/attachment-export/types";
import { getSurveyFileUploadConfigs } from "@/modules/storage/survey-file-upload-elements";
import { Button } from "@/modules/ui/components/button";

/**
 * Export, as a table toolbar action on Responses and Summary: opens the Export modal for every response,
 * or for the ones the toolbar's filters match.
 */
export const ResponseDownloadMenu = ({
  survey,
  getFilters,
  hasFilters,
  disabled = false,
}: Readonly<{
  survey: TSurvey;
  getFilters: () => TResponseFilterCriteria;
  hasFilters: boolean;
  /** While the filter cannot be resolved yet, so an export would cover the unfiltered survey. */
  disabled?: boolean;
}>) => {
  const { t, i18n } = useTranslation();
  // Resolved when the modal opens, so a relative date window means "now" and stays fixed while it is open.
  const [exportFilter, setExportFilter] = useState<TResponseFilterCriteria | null>(null);

  // The attachment items only make sense when the survey actually collects files. Hidden rather than
  // disabled: a survey with no file-upload element has nothing to explain.
  const hasFileUploadElements = useMemo(
    () => getSurveyFileUploadConfigs({ blocks: survey.blocks, questions: survey.questions }).length > 0,
    [survey.blocks, survey.questions]
  );

  const { data: attachmentExports } = useAttachmentExports({
    surveyId: survey.id,
    enabled: hasFileUploadElements,
  });
  const createAttachmentExport = useCreateAttachmentExport({ surveyId: survey.id });

  /**
   * Hands a finished archive to the browser. The URL is presigned for the storage bucket, so the bytes
   * never pass through our servers and the browser can resume an interrupted download against it. Never
   * fetch + blob: the archive can reach several GB.
   */
  const downloadAttachmentExport = async (attachmentExport: TAttachmentExport) => {
    try {
      const url = await getAttachmentExportDownloadUrl({
        surveyId: survey.id,
        exportId: attachmentExport.id,
      });
      window.location.assign(url);
    } catch (err) {
      if (err instanceof V3ApiError && err.code === "attachment_export_expired") {
        toast.error(t("workspace.surveys.responses.attachment_export_expired"));
        return;
      }
      Sentry.captureException(err);
      toast.error(t("workspace.surveys.responses.attachment_export_download_failed"));
    }
  };

  const describeAttachmentExport = (attachmentExport: TAttachmentExport): string => {
    const scope = attachmentExport.filtered
      ? t("workspace.surveys.responses.attachment_export_scope_filtered")
      : t("workspace.surveys.responses.attachment_export_scope_all");
    if (attachmentExport.status === "completed") {
      return t("workspace.surveys.responses.attachment_export_row_ready", {
        scope,
        fileCount: attachmentExport.includedFileCount ?? attachmentExport.fileCount,
        size: formatArchiveSize(attachmentExport.totalBytes ?? 0, i18n.language),
      });
    }
    if (attachmentExport.status === "failed") {
      return t("workspace.surveys.responses.attachment_export_row_failed", { scope });
    }
    return t("workspace.surveys.responses.attachment_export_row_preparing", {
      scope,
      fileCount: attachmentExport.fileCount,
    });
  };

  // Announces an export that finished while this page polled it. Held until dismissed when it is ready:
  // a multi-GB build can take minutes, and the user may have looked away.
  const previousAttachmentExports = useRef<TAttachmentExport[] | undefined>(undefined);
  useEffect(() => {
    if (!attachmentExports) return;
    const settled = findNewlySettledExports(previousAttachmentExports.current, attachmentExports);
    previousAttachmentExports.current = attachmentExports;

    for (const attachmentExport of settled) {
      const toastId = `attachment-export-${attachmentExport.id}`;
      if (attachmentExport.status === "completed") {
        toast.success(
          (current) => (
            <div className="flex flex-col gap-2">
              <span>
                {t("workspace.surveys.responses.attachment_export_ready", {
                  fileCount: attachmentExport.includedFileCount ?? attachmentExport.fileCount,
                  size: formatArchiveSize(attachmentExport.totalBytes ?? 0, i18n.language),
                })}
              </span>
              {attachmentExport.truncated && (
                <span className="text-slate-500">
                  {t("workspace.surveys.responses.attachment_export_truncated")}
                </span>
              )}
              <Button
                size="sm"
                className="self-start"
                onClick={() => {
                  toast.dismiss(current.id);
                  void downloadAttachmentExport(attachmentExport);
                }}>
                <DownloadIcon className="size-4" />
                {t("common.download")}
              </Button>
            </div>
          ),
          { id: toastId, duration: Infinity }
        );
      } else if (attachmentExport.status === "failed") {
        toast.error(t("workspace.surveys.responses.attachment_export_failed"), { id: toastId });
      }
    }
    // `t` and the download handler are stable enough; only new poll results should announce anything.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachmentExports]);

  /** The message for a create error the user can act on, or `null` for an unexpected one. */
  const getAttachmentExportErrorMessage = (err: V3ApiError): string | null => {
    if (err.code === "attachment_export_too_large") {
      return t("workspace.surveys.responses.too_many_attachments_to_download", {
        maxFiles: MAX_ATTACHMENT_FILES,
      });
    }
    if (err.code === "attachment_export_empty") {
      return t("workspace.surveys.responses.no_attachments_to_download");
    }
    if (err.status === 429) return t("workspace.surveys.responses.too_many_attachment_exports");
    return null;
  };

  /**
   * Starts a background export (ENG-6862): the server builds the ZIP into storage and this page is told
   * when it is ready. Falls back to the streaming download when the server cannot run the job, which is
   * the case while an online upgrade is still rolling out.
   */
  const handleDownloadAttachments = async () => {
    // Read before the modal closes and clears it. An empty filter selects every response; sent as none,
    // so the export is listed as "All responses".
    const filters = exportFilter ?? {};
    const filterCriteria = Object.keys(filters).length > 0 ? filters : undefined;
    const toastId = toast.loading(t("workspace.surveys.responses.preparing_attachments_download"));

    try {
      const { attachmentExport, created } = await createAttachmentExport.mutateAsync({ filterCriteria });
      toast.success(
        created
          ? t("workspace.surveys.responses.attachment_export_started", {
              fileCount: attachmentExport.fileCount,
            })
          : t("workspace.surveys.responses.attachment_export_in_progress"),
        { id: toastId, duration: 8000 }
      );
    } catch (err) {
      if (err instanceof V3ApiError && err.code === "attachment_export_unavailable") {
        toast.dismiss(toastId);
        await streamAttachments(filters);
        return;
      }
      const message = err instanceof V3ApiError ? getAttachmentExportErrorMessage(err) : null;
      if (message) {
        toast.error(message, { id: toastId });
        return;
      }
      Sentry.captureException(err);
      toast.error(t("workspace.surveys.responses.error_downloading_attachments"), { id: toastId });
    }
  };

  /**
   * The streaming fallback: navigates to the route that writes the ZIP as the response itself. Kept for
   * one release while a rolling upgrade still has servers that cannot run the background job.
   *
   * It pre-flights because once that route has flushed its 200 and headers it can no longer answer with
   * an error, and a problem document rendered into the tab would replace this page. So ask for the counts
   * first, toast anything the user needs to know, and only then navigate.
   */
  const streamAttachments = async (filterCriteria: TResponseFilterCriteria) => {
    // Resolved once, so the pre-flight and the download ask about the same window.
    const filters = JSON.stringify(filterCriteria);
    const buildUrl = (extra?: Record<string, string>) => {
      const params = new URLSearchParams(extra);
      params.set("filters", filters);
      return `/api/surveys/${survey.id}/attachments?${params.toString()}`;
    };

    // Held from the click until either an error or the navigation, because both phases are slow enough
    // to look like nothing happened: the pre-flight counts every matching file, and the download request
    // then collects them again before the first byte reaches the browser.
    const toastId = toast.loading(t("workspace.surveys.responses.preparing_attachments_download"));

    try {
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
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        disabled={disabled}
        data-testid="fb__custom-filter-export"
        onClick={() => setExportFilter(getFilters())}>
        <DownloadIcon className="size-4" />
        {hasFilters ? t("workspace.surveys.export.export_filtered") : t("workspace.surveys.export.button")}
      </Button>
      <ExportModal
        open={exportFilter !== null}
        onOpenChange={(open) => {
          if (!open) setExportFilter(null);
        }}
        surveyId={survey.id}
        scope={{ filter: exportFilter ?? {} }}
        onDownloadAttachments={hasFileUploadElements ? handleDownloadAttachments : undefined}
        recentAttachmentExports={
          attachmentExports && attachmentExports.length > 0 ? (
            <div className="flex flex-col gap-1 pt-2">
              <p className="text-xs text-slate-500">
                {t("workspace.surveys.responses.recent_attachment_exports")}
              </p>
              <ul className="flex flex-col gap-1">
                {attachmentExports.map((attachmentExport) => (
                  <li
                    key={attachmentExport.id}
                    data-testid="fb__attachment-export-row"
                    className="flex items-center justify-between gap-2 text-xs text-slate-700">
                    <span>{describeAttachmentExport(attachmentExport)}</span>
                    {attachmentExport.status === "completed" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          void downloadAttachmentExport(attachmentExport);
                        }}>
                        <DownloadIcon className="size-4" />
                        {t("common.download")}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : undefined
        }
      />
    </>
  );
};
