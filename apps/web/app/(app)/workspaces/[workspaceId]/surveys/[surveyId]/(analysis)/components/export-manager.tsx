"use client";

import * as Sentry from "@sentry/nextjs";
import { QueryClient, QueryClientProvider, useMutation } from "@tanstack/react-query";
import { type ReactNode, createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TExportRequest } from "@/lib/analysis-export/export-request";
import { ExportRequestError, formatBytes, requestExport, saveBlob } from "./export-client";

export type TStartExport = {
  surveyId: string;
  request: TExportRequest;
  /** How many responses the file holds, from the modal's count: for the progress text and the toast. */
  included?: number;
};

export type TExportProgress = { bytes: number; included: number | null };

type TExportManager = {
  /** Starts an export and returns at once. Progress, the download and a failure all show as a toast. */
  startExport: (args: TStartExport) => void;
  isExporting: boolean;
  /** What the running export has received so far. `null` when none is running. */
  progress: TExportProgress | null;
  /** Stops the running export; the server stops reading when the request is aborted. */
  cancelExport: () => void;
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

type TJob = TStartExport & { signal: AbortSignal; onProgress: (bytes: number) => void };

const ExportManager = ({ children }: Readonly<{ children: ReactNode }>) => {
  const { t } = useTranslation();
  const controllerRef = useRef<AbortController | null>(null);
  const startRef = useRef<(args: TStartExport) => void>(() => undefined);
  const [progress, setProgress] = useState<TExportProgress | null>(null);

  const mutation = useMutation({
    mutationFn: ({ surveyId, request, signal, onProgress }: TJob) =>
      requestExport({ surveyId, request, signal, onProgress }),
    onSuccess: ({ blob, fileName }, job) => {
      saveBlob(blob, fileName ?? "export");
      toast.success(
        <span className="flex flex-col">
          <span className="font-semibold">{t("workspace.surveys.export.export_ready")}</span>
          <span className="text-slate-500">
            {job.included === undefined
              ? t("workspace.surveys.export.export_ready_file", { fileName: fileName ?? "export" })
              : t("workspace.surveys.export.export_ready_file_count", {
                  fileName: fileName ?? "export",
                  count: job.included,
                })}
          </span>
        </span>,
        { id: EXPORT_TOAST_ID, duration: 6000 }
      );
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
                startRef.current({ surveyId: job.surveyId, request: job.request, included: job.included });
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
      setProgress({ bytes: 0, included: args.included ?? null });
      toast.loading(t("workspace.surveys.export.export_starting"), { id: EXPORT_TOAST_ID });

      let lastUpdate = 0;
      mutate({
        ...args,
        signal: controller.signal,
        onProgress: (bytes) => {
          setProgress((current) => (current ? { ...current, bytes } : current));
          const now = Date.now();
          if (now - lastUpdate < PROGRESS_TOAST_INTERVAL_MS) return;
          lastUpdate = now;
          toast.loading(t("workspace.surveys.export.export_progress", { size: formatBytes(bytes) }), {
            id: EXPORT_TOAST_ID,
          });
        },
      });
    },
    [isPending, mutate, t]
  );

  const cancelExport = useCallback(() => controllerRef.current?.abort(), []);

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
    <ExportManagerContext.Provider
      value={{ startExport, cancelExport, isExporting: isPending, progress: isPending ? progress : null }}>
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
