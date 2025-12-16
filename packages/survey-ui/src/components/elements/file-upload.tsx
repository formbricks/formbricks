import { Upload, UploadIcon, X } from "lucide-react";
import * as React from "react";
import { ElementError } from "@/components/general/element-error";
import { ElementHeader } from "@/components/general/element-header";
import { Input } from "@/components/general/input";
import { cn } from "@/lib/utils";

/**
 * Uploaded file information
 */
export interface UploadedFile {
  /** File name */
  name: string;
  /** File URL or data URL */
  url: string;
  /** File size in bytes */
  size?: number;
}

interface FileUploadProps {
  /** Unique identifier for the element container */
  elementId: string;
  /** The main element or prompt text displayed as the headline */
  headline: string;
  /** Optional descriptive text displayed below the headline */
  description?: string;
  /** Unique identifier for the file input */
  inputId: string;
  /** Currently uploaded files */
  value?: UploadedFile[];
  /** Callback function called when files change */
  onChange: (files: UploadedFile[]) => void;
  /** Callback function called when files are selected (before validation) */
  onFileSelect?: (files: FileList) => void;
  /** Whether multiple files are allowed */
  allowMultiple?: boolean;
  /** Allowed file extensions (e.g., ['.pdf', '.jpg', '.png']) */
  allowedFileExtensions?: string[];
  /** Whether the field is required (shows asterisk indicator) */
  required?: boolean;
  /** Error message to display */
  errorMessage?: string;
  /** Whether the component is in uploading state */
  isUploading?: boolean;
  /** Text direction: 'ltr' (left-to-right), 'rtl' (right-to-left), or 'auto' (auto-detect from content) */
  dir?: "ltr" | "rtl" | "auto";
  /** Whether the file input is disabled */
  disabled?: boolean;
  /** Image URL to display above the headline */
  imageUrl?: string;
  /** Video URL to display above the headline */
  videoUrl?: string;
  /** Alt text for the image */
  imageAltText?: string;
  /** Placeholder text for the file upload */
  placeholderText?: string;
}

function FileUpload({
  elementId,
  headline,
  description,
  inputId,
  value = [],
  onChange,
  onFileSelect,
  allowMultiple = false,
  allowedFileExtensions,
  required = false,
  errorMessage,
  isUploading = false,
  dir = "auto",
  disabled = false,
  imageUrl,
  videoUrl,
  imageAltText,
  placeholderText = "Click or drag to upload files",
}: FileUploadProps): React.JSX.Element {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Ensure value is always an array
  const uploadedFiles = Array.isArray(value) ? value : [];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    if (!e.target.files || disabled) return;
    if (onFileSelect) {
      onFileSelect(e.target.files);
    }
    // Reset input to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    if (onFileSelect && e.dataTransfer.files.length > 0) {
      onFileSelect(e.dataTransfer.files);
    }
  };

  const handleDeleteFile = (index: number, e: React.MouseEvent): void => {
    e.stopPropagation();
    const updatedFiles = [...uploadedFiles];
    updatedFiles.splice(index, 1);
    onChange(updatedFiles);
  };

  // Build accept attribute from allowed extensions
  const acceptAttribute = allowedFileExtensions
    ?.map((ext) => (ext.startsWith(".") ? ext : `.${ext}`))
    .join(",");

  // Show uploader if uploading, or if multiple files allowed, or if no files uploaded yet
  const showUploader = isUploading || allowMultiple || uploadedFiles.length === 0;

  return (
    <div className="w-full space-y-4" id={elementId} dir={dir}>
      {/* Headline */}
      <ElementHeader
        headline={headline}
        description={description}
        required={required}
        htmlFor={inputId}
        imageUrl={imageUrl}
        videoUrl={videoUrl}
        imageAltText={imageAltText}
      />

      {/* File Input */}
      <div className="relative">
        <ElementError errorMessage={errorMessage} dir={dir} />

        {/* Dashed border container */}
        <div
          className={cn(
            "w-input px-input-x py-input-y rounded-input relative flex flex-col items-center justify-center border-2 border-dashed transition-colors",
            errorMessage ? "border-destructive" : "border-input-border bg-accent",
            disabled && "cursor-not-allowed opacity-50"
          )}>
          {/* Uploaded files */}
          {uploadedFiles.length > 0 ? (
            <div className="flex w-full flex-col gap-2 p-2">
              {uploadedFiles.map((file, index) => (
                <div
                  key={index}
                  className={cn(
                    "border-input-border bg-accent-selected text-input-text rounded-input relative m-1 rounded-md border"
                  )}>
                  {/* Delete button */}
                  <div className="absolute top-0 right-0 m-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        handleDeleteFile(index, e);
                      }}
                      disabled={disabled}
                      className={cn(
                        "flex h-5 w-5 cursor-pointer items-center justify-center rounded-md",
                        "bg-background hover:bg-accent",
                        disabled && "cursor-not-allowed opacity-50"
                      )}
                      aria-label={`Delete ${file.name}`}>
                      <X className="text-foreground h-5" />
                    </button>
                  </div>
                  {/* File icon and name */}
                  <div className="flex flex-col items-center justify-center p-2">
                    <UploadIcon />
                    <p
                      className="mt-1 w-full overflow-hidden px-2 text-center text-sm overflow-ellipsis whitespace-nowrap text-[var(--foreground)]"
                      title={file.name}>
                      {file.name}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {/* Upload area */}
          <div className="w-full">
            {isUploading ? (
              <div className="flex animate-pulse items-center justify-center rounded-lg py-4">
                <p className="text-muted-foreground text-sm font-medium">Uploading...</p>
              </div>
            ) : null}

            <label
              htmlFor={inputId}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className={cn("block w-full", disabled && "cursor-not-allowed", !showUploader && "hidden")}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                className={cn(
                  "flex w-full flex-col items-center justify-center py-6",
                  "hover:cursor-pointer",
                  disabled && "cursor-not-allowed opacity-50"
                )}
                aria-label="Upload files by clicking or dragging them here">
                <Upload className="text-input-text h-6" aria-hidden="true" />
                {/* need to use style here because tailwind is not able to use css variables for font size and weight */}
                <span className="text-input-text font-input-weight text-input m-2" id={`${inputId}-label`}>
                  {placeholderText}
                </span>
                <Input
                  ref={fileInputRef}
                  type="file"
                  id={inputId}
                  className="hidden"
                  multiple={allowMultiple}
                  accept={acceptAttribute}
                  onChange={handleFileChange}
                  disabled={disabled}
                  required={required}
                  dir={dir}
                  aria-label="File upload"
                  aria-describedby={`${inputId}-label`}
                />
              </button>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

export { FileUpload };
export type { FileUploadProps };
