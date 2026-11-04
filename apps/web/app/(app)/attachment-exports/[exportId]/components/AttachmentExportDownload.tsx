"use client";

import * as Sentry from "@sentry/nextjs";
import { DownloadIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { useAttachmentExportDownload } from "@/modules/storage/attachment-export/hooks/use-attachment-export-download";
import type { TAttachmentExportStatus } from "@/modules/storage/attachment-export/types";
import { Button } from "@/modules/ui/components/button";

type TDownloadState =
  | "starting"
  | "started"
  | "expired"
  | "not_ready"
  | "not_available"
  | "export_failed"
  | "download_failed";

type TAttachmentExportLink = {
  id: string;
  surveyId: string;
  workspaceId: string;
  status: TAttachmentExportStatus;
};

/** What the page says before any download is attempted, from the export's status alone. */
const stateFromStatus = (status: TAttachmentExportStatus): TDownloadState => {
  if (status === "failed") return "export_failed";
  if (status === "expired") return "expired";
  if (status === "completed") return "starting";
  return "not_ready";
};

const stateFromError = (error: unknown): TDownloadState => {
  if (error instanceof V3ApiError) {
    if (error.code === "attachment_export_expired") return "expired";
    if (error.code === "attachment_export_not_ready") return "not_ready";
    if (error.status === 403 || error.status === 404) return "not_available";
  }
  return "download_failed";
};

const DownloadPanel = ({ attachmentExport }: Readonly<{ attachmentExport: TAttachmentExportLink }>) => {
  const { t } = useTranslation();
  const download = useAttachmentExportDownload({
    surveyId: attachmentExport.surveyId,
    exportId: attachmentExport.id,
  });
  const canDownload = attachmentExport.status === "completed";
  // Strict mode runs effects twice in development; one page open is one download.
  const started = useRef(false);

  useEffect(() => {
    if (!canDownload || started.current) return;
    started.current = true;
    download.mutate();
  }, [canDownload, download]);

  useEffect(() => {
    if (download.error && stateFromError(download.error) === "download_failed") {
      Sentry.captureException(download.error);
    }
  }, [download.error]);

  let state = stateFromStatus(attachmentExport.status);
  if (canDownload && download.isSuccess) state = "started";
  if (canDownload && download.isError) state = stateFromError(download.error);

  const messages: Record<TDownloadState, string> = {
    starting: t("workspace.surveys.responses.attachment_export_download_starting"),
    started: t("workspace.surveys.responses.attachment_export_download_started"),
    expired: t("workspace.surveys.responses.attachment_export_expired"),
    not_ready: t("workspace.surveys.responses.attachment_export_not_ready"),
    not_available: t("workspace.surveys.responses.attachment_export_not_available"),
    export_failed: t("workspace.surveys.responses.attachment_export_build_failed"),
    download_failed: t("workspace.surveys.responses.attachment_export_download_failed"),
  };

  return (
    <div className="flex flex-col gap-4">
      <output className="text-sm text-slate-700">{messages[state]}</output>
      <div className="flex flex-wrap gap-2">
        {(state === "started" || state === "download_failed") && (
          <Button size="sm" loading={download.isPending} onClick={() => download.mutate()}>
            <DownloadIcon className="size-4" />
            {t("common.download")}
          </Button>
        )}
        <Button size="sm" variant="secondary" asChild>
          <Link
            href={`/workspaces/${attachmentExport.workspaceId}/surveys/${attachmentExport.surveyId}/responses`}>
            {t("workspace.surveys.responses.go_to_responses")}
          </Link>
        </Button>
      </div>
    </div>
  );
};

/**
 * Starts the download as soon as the page opens (see `useAttachmentExportDownload`), and explains why
 * when it cannot: the export expired, is still building, failed, or is not the viewer's.
 */
export const AttachmentExportDownload = ({
  attachmentExport,
}: Readonly<{ attachmentExport: TAttachmentExportLink | null }>) => {
  const { t } = useTranslation();
  if (!attachmentExport) {
    return (
      <output className="text-sm text-slate-700">
        {t("workspace.surveys.responses.attachment_export_not_available")}
      </output>
    );
  }
  return <DownloadPanel attachmentExport={attachmentExport} />;
};
