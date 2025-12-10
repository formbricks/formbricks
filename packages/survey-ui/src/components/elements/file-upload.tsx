import { Upload, UploadIcon, X } from "lucide-react";
import * as React from "react";
import { ElementError } from "@/components/general/element-error";
import { ElementHeader } from "@/components/general/element-header";
import { Input } from "@/components/general/input";
import { useTextDirection } from "@/hooks/use-text-direction";
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
  /** Whether multiple files are allowed */
  allowMultiple?: boolean;
  /** Maximum file size in MB */
  maxSizeInMB?: number;
  /** Allowed file extensions (e.g., ['.pdf', '.jpg', '.png']) */
  allowedFileExtensions?: string[];
  /** Whether the field is required (shows asterisk indicator) */
  required?: boolean;
  /** Error message to display */
  errorMessage?: string;
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
  allowMultiple = false,
  maxSizeInMB,
  allowedFileExtensions,
  required = false,
  errorMessage,
  dir = "auto",
  disabled = false,
  imageUrl,
  videoUrl,
  imageAltText,
  placeholderText = "Click or drag to upload files",
}: FileUploadProps): React.JSX.Element {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = React.useState(false);

  // Ensure value is always an array
  const uploadedFiles = Array.isArray(value) ? value : [];

  const validateFile = (file: File): string | null => {
    // Check file extension
    if (allowedFileExtensions && allowedFileExtensions.length > 0) {
      const fileExtensionPart = file.name.split(".").pop()?.toLowerCase();
      if (fileExtensionPart) {
        const fileExtension = `.${fileExtensionPart}`;
        if (!allowedFileExtensions.includes(fileExtension)) {
          return `File type ${fileExtension} is not allowed. Allowed types: ${allowedFileExtensions.join(", ")}`;
        }
      }
    }

    // Check file size
    if (maxSizeInMB) {
      const fileSizeInMB = file.size / (1024 * 1024);
      if (fileSizeInMB > maxSizeInMB) {
        return `File size exceeds the maximum allowed size of ${String(maxSizeInMB)}MB`;
      }
    }

    return null;
  };

  const processFiles = async (files: FileList | File[]): Promise<UploadedFile[]> => {
    const fileArray = Array.from(files);
    const processedFiles: UploadedFile[] = [];

    for (const file of fileArray) {
      const error = validateFile(file);
      if (error) {
        // In a real implementation, you might want to show this error
        // eslint-disable-next-line no-console -- Error logging needed for file validation
        console.error(error);
        continue;
      }

      // Create a data URL for preview (in real implementation, upload to server)
      const url = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      });

      processedFiles.push({
        name: file.name,
        url,
        size: file.size,
      });
    }

    return processedFiles;
  };

  const handleFileSelection = async (files: FileList | File[]): Promise<void> => {
    if (disabled) return;

    const fileArray = Array.from(files);

    // Validate file limits
    if (!allowMultiple && fileArray.length > 1) {
      // eslint-disable-next-line no-alert -- Alert needed for user feedback
      alert("Only one file can be uploaded at a time");
      return;
    }

    try {
      setIsUploading(true);
      const newFiles = await processFiles(fileArray);
      if (allowMultiple) {
        onChange([...uploadedFiles, ...newFiles]);
      } else {
        onChange(newFiles.slice(0, 1));
      }
    } catch (err) {
      // eslint-disable-next-line no-console -- Error logging needed
      console.error("Error uploading files:", err);
    } finally {
      setIsUploading(false);
      // Reset input to allow selecting the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    if (!e.target.files || disabled) return;
    await handleFileSelection(e.target.files);
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    void handleFileSelection(e.dataTransfer.files);
  };

  const handleDeleteFile = (index: number, e: React.MouseEvent): void => {
    e.stopPropagation();
    const updatedFiles = [...uploadedFiles];
    updatedFiles.splice(index, 1);
    onChange(updatedFiles);
  };

  // Detect text direction from content
  const detectedDir = useTextDirection({
    dir,
    textContent: [headline, description ?? ""],
  });

  // Build accept attribute from allowed extensions
  const acceptAttribute = allowedFileExtensions
    ?.map((ext) => (ext.startsWith(".") ? ext : `.${ext}`))
    .join(",");

  // Show uploader if uploading, or if multiple files allowed, or if no files uploaded yet
  const showUploader = isUploading || allowMultiple || uploadedFiles.length === 0;

  return (
    <div className="w-full space-y-4" id={elementId} dir={detectedDir}>
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
      <div className="relative space-y-2">
        <ElementError errorMessage={errorMessage} dir={detectedDir} />

        {/* Dashed border container */}
        <div
          className={cn(
            "relative flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors",
            errorMessage
              ? "border-destructive"
              : "border-input-border bg-input-bg hover:bg-input-hover-bg rounded-input",
            disabled && "cursor-not-allowed opacity-50"
          )}>
          {/* Uploaded files */}
          {uploadedFiles.length > 0 ? (
            <div className="flex w-full flex-col gap-2 p-2">
              {uploadedFiles.map((file, index) => (
                <div
                  key={index}
                  className={cn(
                    "border-input-border bg-input-bg text-input-text rounded-input relative m-1 rounded-md border"
                  )}>
                  {/* Delete button */}
                  <div className="absolute right-0 top-0 m-2">
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
                      className="mt-1 w-full overflow-hidden overflow-ellipsis whitespace-nowrap px-2 text-center text-sm text-[var(--foreground)]"
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
                <span
                  className="text-input-text m-2 text-sm"
                  id={`${inputId}-label`}
                  style={{
                    fontSize: "var(--fb-input-font-size)",
                    fontWeight: "var(--fb-input-font-weight)",
                  }}>
                  {placeholderText}
                </span>
                <Input
                  ref={fileInputRef}
                  type="file"
                  id={inputId}
                  className="hidden"
                  multiple={allowMultiple}
                  accept={acceptAttribute}
                  onChange={(e) => {
                    void handleFileChange(e);
                  }}
                  disabled={disabled}
                  required={required}
                  dir={detectedDir}
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
