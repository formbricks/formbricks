"use client";

import { ArrowUpFromLineIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";

export interface FileDropZoneProps {
  id: string;
  accept?: string;
  onFileSelect: (file: File) => void | Promise<void>;
  isLoading?: boolean;
  disabled?: boolean;
  primaryText: string;
  secondaryText?: string;
  helpText?: string;
  loadingText?: string;
  className?: string;
}

export const FileDropZone = ({
  id,
  accept,
  onFileSelect,
  isLoading = false,
  disabled = false,
  primaryText,
  secondaryText,
  helpText,
  loadingText,
  className,
}: Readonly<FileDropZoneProps>) => {
  const { t } = useTranslation();
  const [isProcessing, setIsProcessing] = useState(false);
  const isBusy = isLoading || isProcessing;
  const resolvedLoadingText = loadingText ?? t("common.loading");

  const handleFile = async (file: File | undefined) => {
    if (!file || isBusy || disabled) return;

    try {
      const result = onFileSelect(file);
      if (result instanceof Promise) {
        setIsProcessing(true);
        await result;
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (isBusy || disabled) return;
    void handleFile(e.dataTransfer.files[0]);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    void handleFile(e.target.files?.[0]);
    e.target.value = "";
  };

  return (
    <div
      className={cn(
        "rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-6",
        isBusy && "opacity-70",
        className
      )}
      aria-busy={isBusy}>
      {/* Drag-and-drop is an enhancement; the keyboard-accessible path is the associated file input below. */}
      <label
        htmlFor={id}
        className={cn(
          "flex flex-col items-center justify-center",
          isBusy || disabled ? "cursor-not-allowed" : "cursor-pointer"
        )}
        onDragOver={handleDragOver}
        onDrop={handleDrop}>
        {isBusy ? (
          <>
            <LoadingSpinner className="h-8 w-8" />
            <p className="mt-2 text-sm text-slate-600">{resolvedLoadingText}</p>
          </>
        ) : (
          <>
            <ArrowUpFromLineIcon className="size-8 text-slate-400" aria-hidden="true" />
            <p className="mt-2 text-sm text-slate-600">
              <span className="font-semibold">{primaryText}</span>
              {secondaryText ? ` ${secondaryText}` : null}
            </p>
            {helpText ? <p className="mt-1 text-xs text-slate-400">{helpText}</p> : null}
          </>
        )}
        <input
          type="file"
          id={id}
          accept={accept}
          className="hidden"
          disabled={isBusy || disabled}
          onChange={handleChange}
        />
      </label>
    </div>
  );
};
