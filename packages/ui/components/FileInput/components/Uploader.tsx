import { ArrowUpFromLineIcon } from "lucide-react";
import { cn } from "@formbricks/lib/cn";
import { TAllowedFileExtension } from "@formbricks/types/common";

interface UploaderProps {
  id: string;
  name: string;
  handleDragOver: (e: React.DragEvent<HTMLLabelElement>) => void;
  uploaderClassName: string;
  handleDrop: (e: React.DragEvent<HTMLLabelElement>) => void;
  allowedFileExtensions: TAllowedFileExtension[];
  multiple: boolean;
  handleUpload: (files: File[]) => void;
  uploadMore?: boolean;
}

export const Uploader = ({
  id,
  name,
  handleDragOver,
  uploaderClassName,
  handleDrop,
  allowedFileExtensions,
  multiple,
  handleUpload,
  uploadMore = false,
}: UploaderProps) => {
  return (
    <label
      htmlFor={`${id}-${name}`}
      className={cn(
        "relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:hover:border-slate-500 dark:hover:bg-slate-800",
        uploaderClassName
      )}
      onDragOver={(e) => handleDragOver(e)}
      onDrop={(e) => handleDrop(e)}>
      <div className="flex flex-col items-center justify-center pb-6 pt-5">
        <ArrowUpFromLineIcon className="h-6 text-slate-500" />
        <p className={cn("mt-2 text-center text-sm text-slate-500", uploadMore && "text-xs")}>
          <span className="font-semibold">Click or drag to upload files.</span>
        </p>
        <input
          type="file"
          id={`${id}-${name}`}
          name={`${id}-${name}`}
          accept={allowedFileExtensions.map((ext) => `.${ext}`).join(",")}
          className="hidden"
          multiple={multiple}
          onChange={async (e) => {
            let selectedFiles = Array.from(e.target?.files || []);
            handleUpload(selectedFiles);
          }}
        />
      </div>
    </label>
  );
};
