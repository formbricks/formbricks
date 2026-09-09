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
  const [isDragActive, setIsDragActive] = useState(false);
  const isBusy = isLoading || isProcessing;
  const isInteractive = !isBusy && !disabled;
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

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (isInteractive && !isDragActive) setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    // Leaving a child fires dragleave too; only a move outside the zone ends the active state.
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (!isInteractive) return;
    void handleFile(e.dataTransfer.files[0]);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    void handleFile(e.target.files?.[0]);
    e.target.value = "";
  };

  return (
    <div
      className={cn(
        "group rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-6",
        "transition-[border-color,background-color,transform] duration-200 ease-out motion-reduce:transition-none",
        isInteractive && "hover:border-slate-400 hover:bg-slate-100",
        isDragActive && "scale-[1.01] border-slate-500 bg-slate-100 motion-reduce:transform-none",
        isBusy && "opacity-70",
        className
      )}
      aria-busy={isBusy}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}>
      {/* Drag-and-drop is an enhancement; the keyboard-accessible path is the associated file input below. */}
      <label
        htmlFor={id}
        className={cn(
          "flex flex-col items-center justify-center",
          isInteractive ? "cursor-pointer" : "cursor-not-allowed"
        )}>
        {isBusy ? (
          <>
            <LoadingSpinner className="h-8 w-8" />
            <p className="mt-2 text-sm text-slate-600">{resolvedLoadingText}</p>
          </>
        ) : (
          <>
            <ArrowUpFromLineIcon
              className={cn(
                "size-8 text-slate-400 transition-[transform,color] duration-200 ease-out motion-reduce:transition-none",
                isInteractive && "group-hover:-translate-y-0.5 group-hover:text-slate-500",
                isDragActive && "-translate-y-1 text-slate-600"
              )}
              aria-hidden="true"
            />
            <p className="mt-2 text-sm text-slate-600">
              <span className="font-semibold">{primaryText}</span>
              {secondaryText ? ` ${secondaryText}` : null}
            </p>
            {helpText ? <p className="mt-1 text-xs text-slate-400">{helpText}</p> : null}
          </>
        )}
        {/* sr-only (not `hidden`) keeps the input in the tab order so keyboard users can focus it
            and open the file picker with Enter/Space; the visible dropzone is the label above. */}
        <input
          type="file"
          id={id}
          accept={accept}
          className="sr-only"
          disabled={isBusy || disabled}
          onChange={handleChange}
        />
      </label>
    </div>
  );
};
