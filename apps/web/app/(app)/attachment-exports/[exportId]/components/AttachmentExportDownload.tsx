"use client";

import * as Sentry from "@sentry/nextjs";
import { DownloadIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { getAttachmentExportDownloadUrl } from "@/modules/storage/attachment-export/lib/api-client";
import type { TAttachmentExportStatus } from "@/modules/storage/attachment-export/types";
import { Button } from "@/modules/ui/components/button";

type TDownloadState = "starting" | "started" | "expired" | "not_ready" | "not_available" | "failed";

const initialState = (status: TAttachmentExportStatus | undefined): TDownloadState => {
  if (!status || status === "failed") return "not_available";
  if (status === "expired") return "expired";
  if (status === "completed") return "starting";
  return "not_ready";
};

/**
 * Starts the download as soon as the page opens, by navigating to a presigned storage URL: the browser
 * fetches the archive straight from storage and can resume an interrupted transfer. Never fetch + blob,
 * the archive can reach several GB.
 */
export const AttachmentExportDownload = ({
  attachmentExport,
}: Readonly<{
  attachmentExport: {
    id: string;
    surveyId: string;
    workspaceId: string;
    status: TAttachmentExportStatus;
  } | null;
}>) => {
  const { t } = useTranslation();
  const [state, setState] = useState<TDownloadState>(() => initialState(attachmentExport?.status));
  // Strict mode runs effects twice in development; one page open is one download.
  const started = useRef(false);

  const download = useCallback(async () => {
    if (!attachmentExport) return;
    setState("starting");
    try {
      const url = await getAttachmentExportDownloadUrl({
        surveyId: attachmentExport.surveyId,
        exportId: attachmentExport.id,
      });
      window.location.assign(url);
      setState("started");
    } catch (err) {
      if (err instanceof V3ApiError) {
        if (err.code === "attachment_export_expired") return setState("expired");
        if (err.code === "attachment_export_not_ready") return setState("not_ready");
        if (err.status === 403 || err.status === 404) return setState("not_available");
      }
      Sentry.captureException(err);
      setState("failed");
    }
  }, [attachmentExport]);

  useEffect(() => {
    if (state !== "starting" || started.current) return;
    started.current = true;
    void download();
  }, [state, download]);

  const messages: Record<TDownloadState, string> = {
    starting: t("workspace.surveys.responses.attachment_export_download_starting"),
    started: t("workspace.surveys.responses.attachment_export_download_started"),
    expired: t("workspace.surveys.responses.attachment_export_expired"),
    not_ready: t("workspace.surveys.responses.attachment_export_not_ready"),
    not_available: t("workspace.surveys.responses.attachment_export_not_available"),
    failed: t("workspace.surveys.responses.attachment_export_download_failed"),
  };

  return (
    <div className="flex flex-col gap-4">
      <output className="text-sm text-slate-700">{messages[state]}</output>
      <div className="flex flex-wrap gap-2">
        {(state === "started" || state === "failed") && (
          <Button size="sm" onClick={() => void download()}>
            <DownloadIcon className="size-4" />
            {t("common.download")}
          </Button>
        )}
        {attachmentExport && (
          <Button size="sm" variant="secondary" asChild>
            <Link
              href={`/workspaces/${attachmentExport.workspaceId}/surveys/${attachmentExport.surveyId}/responses`}>
              {t("workspace.surveys.responses.go_to_responses")}
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
};
