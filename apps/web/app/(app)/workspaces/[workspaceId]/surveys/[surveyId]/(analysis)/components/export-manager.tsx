"use client";

import * as Sentry from "@sentry/nextjs";
import { useMutation } from "@tanstack/react-query";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TExportRequest } from "@/lib/analysis-export/export-request";
import { useBeforeUnloadPrompt } from "@/modules/ui/hooks/use-before-unload-prompt";
import { ExportRequestError, formatBytes, requestExport, saveBlob } from "./export-client";
import { rowProgressOutput } from "./export-options";

export type TStartExport = {
  surveyId: string;
  request: TExportRequest;
  /** How many responses the file holds, from the modal's count: for the progress text and the toast. */
  included?: number;
};

/** `rows` is how many responses are in the file so far, `null` when the file cannot be counted as it arrives. */
export type TExportProgress = { bytes: number; rows: number | null; included: number | null };

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

type TJob = TStartExport & {
  signal: AbortSignal;
  onProgress: (bytes: number) => void;
  rowOutput: "csv" | "zip" | null;
  onRows: (rows: number) => void;
};

const ExportManager = ({ children }: Readonly<{ children: ReactNode }>) => {
  const { t } = useTranslation();
  const controllerRef = useRef<AbortController | null>(null);
  const startRef = useRef<(args: TStartExport) => void>(() => undefined);
  const [progress, setProgress] = useState<TExportProgress | null>(null);

  const mutation = useMutation({
    mutationFn: ({ surveyId, request, signal, onProgress, rowOutput, onRows }: TJob) =>
      requestExport({ surveyId, request, signal, onProgress, rowOutput, onRows }),
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

  // A reload or a closed tab drops a running export, which can take minutes: ask first.
  useBeforeUnloadPrompt(() => isPending);

  const startExport = useCallback(
    (args: TStartExport) => {
      if (isPending) {
        toast(t("workspace.surveys.export.export_already_running"));
        return;
      }
      const controller = new AbortController();
      controllerRef.current = controller;
      // Rows are only counted against a known total.
      const total = args.included;
      const rowOutput = total ? rowProgressOutput(args.request) : null;
      setProgress({ bytes: 0, rows: rowOutput ? 0 : null, included: total ?? null });
      toast.loading(t("workspace.surveys.export.export_starting"), { id: EXPORT_TOAST_ID });

      let lastUpdate = 0;
      const showInToast = (message: string) => {
        const now = Date.now();
        if (now - lastUpdate < PROGRESS_TOAST_INTERVAL_MS) return;
        lastUpdate = now;
        toast.loading(message, { id: EXPORT_TOAST_ID });
      };
      mutate({
        ...args,
        signal: controller.signal,
        rowOutput,
        onProgress: (bytes) => {
          setProgress((current) => (current ? { ...current, bytes } : current));
          if (!rowOutput) {
            showInToast(t("workspace.surveys.export.export_progress", { size: formatBytes(bytes) }));
          }
        },
        onRows: (received) => {
          const rows = Math.min(received, total ?? received);
          setProgress((current) => (current ? { ...current, rows } : current));
          showInToast(t("workspace.surveys.export.export_progress_rows", { rows, total }));
        },
      });
    },
    [isPending, mutate, t]
  );

  const cancelExport = useCallback(() => controllerRef.current?.abort(), []);

  useEffect(() => {
    startRef.current = startExport;
  }, [startExport]);

  // The export runs in the app: leaving the surveys area (or the site) cancels it, and the server stops
  // reading when the request is aborted. Moving between a survey's pages, the editor and the list keeps this
  // mounted.
  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
      toast.dismiss(EXPORT_TOAST_ID);
    };
  }, []);

  // Memoized because every progress tick re-renders this provider, and a fresh object here would
  // re-render every `useExportManager` consumer (the modal, the export button) on each one.
  const value = useMemo(
    () => ({ startExport, cancelExport, isExporting: isPending, progress: isPending ? progress : null }),
    [startExport, cancelExport, isPending, progress]
  );

  return <ExportManagerContext.Provider value={value}>{children}</ExportManagerContext.Provider>;
};

/**
 * Owns the export for as long as the surveys layout is mounted, so closing the Export modal or moving
 * between Summary, Responses and the editor does not cancel it. Runs on the surveys area's QueryClient,
 * which also serves the modal's count line.
 */
export const ExportManagerProvider = ({ children }: Readonly<{ children: ReactNode }>) => (
  <ExportManager>{children}</ExportManager>
);
