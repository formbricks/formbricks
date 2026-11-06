"use client";

import { useMutation } from "@tanstack/react-query";
import { getAttachmentExportDownloadUrl } from "../lib/api-client";

/**
 * Starts the download of a completed export by navigating to a fresh presigned storage URL: the browser
 * fetches the archive straight from storage and can resume an interrupted transfer. Never fetch + blob,
 * the archive can reach several GB. A mutation, not a query: every call is an audited export.
 */
export const useAttachmentExportDownload = ({
  surveyId,
  exportId,
}: Readonly<{ surveyId: string; exportId: string }>) =>
  useMutation({
    mutationFn: () => getAttachmentExportDownloadUrl({ surveyId, exportId }),
    onSuccess: (url) => window.location.assign(url),
  });
