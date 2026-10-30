"use client";

import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { saveBlobAsFile } from "@/lib/utils/file-download";
import { fetchSurveyExport } from "../lib/api-client";
import type { TSurveyExportFormat } from "../lib/formats";

/**
 * Download a survey's export: fetched, then saved as a file only once the server has answered 200, so a
 * refusal reaches the caller as an error to show instead of a file holding problem JSON. Leaving the
 * page, or starting another download, aborts the request in flight.
 */
export const useExportSurvey = () => {
  const inFlight = useRef<AbortController | null>(null);
  useEffect(() => () => inFlight.current?.abort(), []);

  return useMutation({
    mutationFn: async ({ surveyId, format }: { surveyId: string; format: TSurveyExportFormat }) => {
      inFlight.current?.abort();
      const controller = new AbortController();
      inFlight.current = controller;
      const { blob, fileName } = await fetchSurveyExport({ surveyId, format, signal: controller.signal });
      if (!controller.signal.aborted) saveBlobAsFile(blob, fileName);
    },
  });
};
