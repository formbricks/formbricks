import { cn } from "@/lib/cn";
import { ArrowUpFromLineIcon } from "lucide-react";
import React from "react";
import { TAllowedFileExtension } from "@formbricks/types/common";

interface UploaderProps {
  id: string;
  name: string;
  ref?: React.RefObject<HTMLInputElement>;
  handleDragOver: (e: React.DragEvent<HTMLLabelElement>) => void;
  uploaderClassName: string;
  handleDrop: (e: React.DragEvent<HTMLLabelElement>) => void;
  allowedFileExtensions: TAllowedFileExtension[];
  multiple: boolean;
  handleUpload: (files: File[]) => void;
  uploadMore?: boolean;
  disabled?: boolean;
}

export const Uploader = ({
  id,
  name,
  ref,
  handleDragOver,
  uploaderClassName,
  handleDrop,
  allowedFileExtensions,
  multiple,
  handleUpload,
  uploadMore = false,
  disabled = false,
}: UploaderProps) => {
  return (
    <label
      htmlFor={`${id}-${name}`}
      data-testId="upload-file-label"
      className={cn(
        "relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-700",
        uploaderClassName,
        disabled
          ? "cursor-not-allowed opacity-50"
          : "hover:bg-slate-100 dark:hover:border-slate-500 dark:hover:bg-slate-800"
      )}
      onDragOver={(e) => !disabled && handleDragOver(e)}
      onDrop={(e) => !disabled && handleDrop(e)}>
      <div className="flex flex-col items-center justify-center pb-6 pt-5">
        <ArrowUpFromLineIcon className="h-6 text-slate-500" />
        <p className={cn("mt-2 text-center text-sm text-slate-500", uploadMore && "text-xs")}>
          <span className="font-semibold">Click or drag to upload files.</span>
        </p>
        <input
          data-testid="upload-file-input"
          type="file"
          id={`${id}-${name}`}
          name={`${id}-${name}`}
          accept={allowedFileExtensions.map((ext) => `.${ext}`).join(",")}
          className="hidden"
          multiple={multiple}
          disabled={disabled}
          ref={ref}
          onChange={async (e) => {
            let selectedFiles = Array.from(e.target?.files || []);
            handleUpload(selectedFiles);
          }}
        />
      </div>
    </label>
  );
};
