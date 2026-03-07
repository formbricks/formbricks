import { Upload, UploadIcon, X } from "lucide-react";
import * as React from "react";
import { ElementError } from "@/components/general/element-error";
import { ElementHeader } from "@/components/general/element-header";
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
  /** Custom label for the required indicator */
  requiredLabel?: string;
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
  /** Threading function from the caller */
  t?: TFunction;
  /** Placeholder text for the file upload */
  placeholderText?: string;
}

interface UploadedFileItemProps {
  file: UploadedFile;
  index: number;
  disabled: boolean;
  onDelete: (index: number, e: React.MouseEvent) => void;
}

function UploadedFileItem({
  file,
  index,
  disabled,
  onDelete,
}: Readonly<UploadedFileItemProps>): React.JSX.Element {
  return (
    <div
      className={cn(
        "border-input-border bg-accent-selected text-input-text rounded-input relative m-1 rounded-md border"
      )}>
      <div className="absolute top-0 right-0 m-2">
        <button
          type="button"
          onClick={(e) => {
            onDelete(index, e);
          }}
          disabled={disabled}
          className={cn(
            "flex h-5 w-5 cursor-pointer items-center justify-center rounded-md",
            "bg-background hover:bg-accent",
            disabled && "cursor-not-allowed opacity-50"
          )}
          aria-label={t("common.delete_filename", { filename: file.name })}>
          <X className="text-foreground h-5" />
        </button>
      </div>
      <div className="flex flex-col items-center justify-center p-2">
        <UploadIcon />
        <p
          style={{ fontSize: "var(--fb-input-font-size)" }}
          className="mt-1 w-full overflow-hidden px-2 text-center overflow-ellipsis whitespace-nowrap text-[var(--foreground)]"
          title={file.name}>
          {file.name}
        </p>
      </div>
    </div>
  );
}

interface UploadedFilesListProps {
  files: UploadedFile[];
  disabled: boolean;
  onDelete: (index: number, e: React.MouseEvent) => void;
}

function UploadedFilesList({
  files,
  disabled,
  onDelete,
}: Readonly<UploadedFilesListProps>): React.JSX.Element | null {
  if (files.length === 0) {
    return null;
  }

  return (
    <div className="flex w-full flex-col gap-2 p-2">
      {files.map((file, index) => (
        <UploadedFileItem
          key={`${file.name}-${file.url}`}
          file={file}
          index={index}
          disabled={disabled}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

interface UploadAreaProps {
  inputId: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  placeholderText: string;
  allowMultiple: boolean;
  acceptAttribute?: string;
  disabled: boolean;
  dir: "ltr" | "rtl" | "auto";
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDragOver: (e: React.DragEvent<HTMLLabelElement>) => void;
  onDrop: (e: React.DragEvent<HTMLLabelElement>) => void;
  showUploader: boolean;
}

function UploadArea({
  inputId,
  fileInputRef,
  placeholderText,
  allowMultiple,
  acceptAttribute,
  disabled,
  dir,
  onFileChange,
  onDragOver,
  onDrop,
  showUploader,
}: Readonly<UploadAreaProps>): React.JSX.Element | null {
  if (!showUploader) {
    return null;
  }

  return (
    <label
      htmlFor={inputId}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn("block w-full", disabled && "cursor-not-allowed")}>
      <button
        type="button"
        onClick={() => {
          if (fileInputRef.current) {
            fileInputRef.current.click();
          }
        }}
        disabled={disabled}
        className={cn(
          "flex w-full flex-col items-center justify-center py-6",
          "hover:cursor-pointer",
          disabled && "cursor-not-allowed opacity-50"
        )}
        aria-label={t("common.upload_input_aria_description")}>
        <Upload className="text-input-text h-6" aria-hidden="true" />
        <span
          className="text-input-text font-input-weight m-2"
          style={{ fontSize: "var(--fb-input-font-size)" }}
          id={`${inputId}-label`}>
          {placeholderText}
        </span>
        <input
          ref={fileInputRef}
          type="file"
          id={inputId}
          className="sr-only"
          multiple={allowMultiple}
          accept={acceptAttribute}
          onChange={onFileChange}
          disabled={disabled}
          dir={dir}
          aria-label={t("templates.file_upload")}
          aria-describedby={`${inputId}-label`}
        />
      </button>
    </label>
  );
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
  requiredLabel,
  errorMessage,
  isUploading = false,
  dir = "auto",
  disabled = false,
  imageUrl,
  videoUrl,
  imageAltText,
  t = mockT,
  placeholderText = t("emails.click_or_drag_to_upload_files"),
}: Readonly<FileUploadProps>): React.JSX.Element {
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
      <ElementHeader
        headline={headline}
        description={description}
        required={required}
        requiredLabel={requiredLabel}
        htmlFor={inputId}
        imageUrl={imageUrl}
        videoUrl={videoUrl}
        imageAltText={imageAltText}
      />

      <div className="relative">
        <ElementError errorMessage={errorMessage} dir={dir} />

        <div
          className={cn(
            "w-input px-input-x py-input-y rounded-input bg-accent relative flex flex-col items-center justify-center border-2 border-dashed transition-colors",
            errorMessage ? "border-destructive" : "border-input-border",
            disabled && "cursor-not-allowed opacity-50"
          )}>
          <UploadedFilesList files={uploadedFiles} disabled={disabled} onDelete={handleDeleteFile} />

          <div className="w-full">
            {isUploading ? (
              <div className="flex animate-pulse items-center justify-center rounded-lg py-4">
                <p
                  className="text-muted-foreground font-medium"
                  style={{ fontSize: "var(--fb-input-font-size)" }}>
                  {t("common.uploading")}
                </p>
              </div>
            ) : null}

            <UploadArea
              inputId={inputId}
              fileInputRef={fileInputRef}
              placeholderText={placeholderText}
              allowMultiple={allowMultiple}
              acceptAttribute={acceptAttribute}
              disabled={disabled}
              dir={dir}
              onFileChange={handleFileChange}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              showUploader={showUploader}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export { FileUpload };
export type { FileUploadProps };
