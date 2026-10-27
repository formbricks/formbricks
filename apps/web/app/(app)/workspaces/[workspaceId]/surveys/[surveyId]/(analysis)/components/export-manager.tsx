"use client";

import * as Sentry from "@sentry/nextjs";
import { QueryClient, QueryClientProvider, useMutation } from "@tanstack/react-query";
import { type ReactNode, createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TExportRequest } from "@/lib/analysis-export/export-request";
import { ExportRequestError, requestExport, saveBlob } from "./export-client";

export type TStartExport = { surveyId: string; request: TExportRequest };

type TExportManager = {
  /** Starts an export and returns at once. Progress, the download and a failure all show as a toast. */
  startExport: (args: TStartExport) => void;
  isExporting: boolean;
};

const ExportManagerContext = createContext<TExportManager | null>(null);

export const useExportManager = (): TExportManager => {
  const context = useContext(ExportManagerContext);
  if (!context) throw new Error("useExportManager must be used within an ExportManagerProvider");
  return context;
};

const EXPORT_TOAST_ID = "survey-export";
const PROGRESS_TOAST_INTERVAL_MS = 400;
/** Reasons the route gives that a person can act on; anything else reads as a plain failure. */
const READABLE_FAILURES = new Set([422, 429, 503]);

const formatSize = (bytes: number): string =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

type TJob = TStartExport & { signal: AbortSignal; onProgress: (bytes: number) => void };

const ExportManager = ({ children }: Readonly<{ children: ReactNode }>) => {
  const { t } = useTranslation();
  const controllerRef = useRef<AbortController | null>(null);
  const startRef = useRef<(args: TStartExport) => void>(() => undefined);

  const mutation = useMutation({
    mutationFn: ({ surveyId, request, signal, onProgress }: TJob) =>
      requestExport({ surveyId, request, signal, onProgress }),
    onSuccess: ({ blob, fileName }) => {
      saveBlob(blob, fileName ?? "export");
      toast.success(t("workspace.surveys.export.export_finished"), { id: EXPORT_TOAST_ID, duration: 6000 });
    },
    onError: (error, job) => {
      if (job.signal.aborted) {
        toast.dismiss(EXPORT_TOAST_ID);
        return;
      }
      if (!(error instanceof ExportRequestError)) Sentry.captureException(error);
      const message =
        error instanceof ExportRequestError && READABLE_FAILURES.has(error.status)
          ? error.message
          : t("workspace.surveys.export.export_failed");
      toast.error(
        (toastInstance) => (
          <span className="flex items-center gap-3">
            <span>{message}</span>
            <button
              type="button"
              className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => {
                toast.dismiss(toastInstance.id);
                startRef.current({ surveyId: job.surveyId, request: job.request });
              }}>
              {t("common.try_again")}
            </button>
          </span>
        ),
        { id: EXPORT_TOAST_ID, duration: 20000 }
      );
    },
  });

  const { isPending, mutate } = mutation;

  const startExport = useCallback(
    (args: TStartExport) => {
      if (isPending) {
        toast(t("workspace.surveys.export.export_already_running"));
        return;
      }
      const controller = new AbortController();
      controllerRef.current = controller;
      toast.loading(t("workspace.surveys.export.export_starting"), { id: EXPORT_TOAST_ID });

      let lastUpdate = 0;
      mutate({
        ...args,
        signal: controller.signal,
        onProgress: (bytes) => {
          const now = Date.now();
          if (now - lastUpdate < PROGRESS_TOAST_INTERVAL_MS) return;
          lastUpdate = now;
          toast.loading(t("workspace.surveys.export.export_progress", { size: formatSize(bytes) }), {
            id: EXPORT_TOAST_ID,
          });
        },
      });
    },
    [isPending, mutate, t]
  );

  useEffect(() => {
    startRef.current = startExport;
  }, [startExport]);

  // The export runs in the app: leaving the survey (or the site) cancels it, and the server stops
  // reading when the request is aborted. Moving between Summary and Responses keeps this mounted.
  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
      toast.dismiss(EXPORT_TOAST_ID);
    };
  }, []);

  return (
    <ExportManagerContext.Provider value={{ startExport, isExporting: isPending }}>
      {children}
    </ExportManagerContext.Provider>
  );
};

/**
 * Owns the survey's export for as long as the survey layout is mounted, so closing the Export modal or
 * moving between Summary and Responses does not cancel it. Wraps its own QueryClient, which also serves
 * the modal's count line.
 */
export const ExportManagerProvider = ({ children }: Readonly<{ children: ReactNode }>) => {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { mutations: { retry: false } } }));
  return (
    <QueryClientProvider client={queryClient}>
      <ExportManager>{children}</ExportManager>
    </QueryClientProvider>
  );
};
