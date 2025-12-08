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
  /** The main question or prompt text displayed as the headline */
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
}: FileUploadProps): React.JSX.Element {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Ensure value is always an array
  const uploadedFiles = Array.isArray(value) ? value : [];

  const validateFile = (file: File): string | null => {
    // Check file extension
    if (allowedFileExtensions && allowedFileExtensions.length > 0) {
      const fileExtension = `.${file.name.split(".").pop()?.toLowerCase()}`;
      if (!allowedFileExtensions.includes(fileExtension)) {
        return `File type ${fileExtension} is not allowed. Allowed types: ${allowedFileExtensions.join(", ")}`;
      }
    }

    // Check file size
    if (maxSizeInMB) {
      const fileSizeInMB = file.size / (1024 * 1024);
      if (fileSizeInMB > maxSizeInMB) {
        return `File size exceeds the maximum allowed size of ${maxSizeInMB}MB`;
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
        console.error(error);
        continue;
      }

      // Create a data URL for preview (in real implementation, upload to server)
      const url = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || disabled) return;

    const newFiles = await processFiles(e.target.files);
    if (allowMultiple) {
      onChange([...uploadedFiles, ...newFiles]);
    } else {
      onChange(newFiles.slice(0, 1));
    }

    // Reset input to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleBrowseClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
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

  // Get display file name (first file if single, count if multiple)
  const displayFileName =
    uploadedFiles.length > 0
      ? allowMultiple
        ? `${uploadedFiles.length} file${uploadedFiles.length > 1 ? "s" : ""} selected`
        : (uploadedFiles[0]?.name ?? "No file selected")
      : "No file selected";

  return (
    <div className="w-full space-y-4" id={elementId} dir={detectedDir}>
      {/* Headline */}
      <ElementHeader headline={headline} description={description} required={required} htmlFor={inputId} />

      {/* File Input */}
      <div className="relative space-y-2">
        <ElementError errorMessage={errorMessage} dir={detectedDir} />

        {/* Input Field Wrapper */}
        <div
          className={cn(
            "bg-background relative rounded-md border shadow-sm",
            errorMessage && "border-destructive"
          )}
          style={{
            borderColor: errorMessage ? "var(--destructive)" : "var(--fb-input-border-color)",
            borderRadius: "var(--fb-input-border-radius)",
            boxShadow: "var(--fb-input-shadow)",
          }}>
          {/* Input Field Content */}
          <div
            className={cn(
              "flex min-h-[36px] items-center gap-3 rounded-md border py-0 pr-3",
              disabled && "cursor-not-allowed opacity-50"
            )}
            style={{
              backgroundColor: "var(--fb-input-bg-color)",
              borderColor: errorMessage ? "var(--destructive)" : "var(--fb-input-border-color)",
            }}>
            {/* Browse button - first (left for LTR, right for RTL) */}
            <button
              type="button"
              onClick={handleBrowseClick}
              disabled={disabled}
              className={cn(
                "shrink-0 rounded-md px-3 py-2 text-xs font-medium transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                disabled && "cursor-not-allowed opacity-50"
              )}
              style={{
                color: "var(--fb-input-color)",
              }}
              dir={detectedDir}>
              Browse...
            </button>

            {/* File name display - second (right for LTR, left for RTL) */}
            <p
              className="flex-1 truncate whitespace-nowrap text-sm"
              style={{
                fontFamily: "var(--fb-input-font-family)",
                fontSize: "var(--fb-input-font-size)",
                fontWeight: "var(--fb-input-font-weight)" as React.CSSProperties["fontWeight"],
                color: "var(--fb-input-color)",
              }}
              dir={detectedDir}>
              {displayFileName}
            </p>

            {/* Hidden file input */}
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
              dir={detectedDir}
            />
          </div>

          {/* Error ring overlay */}
          {errorMessage && (
            <div
              className="pointer-events-none absolute inset-[-1px] rounded-md border-2"
              style={{
                borderColor: "var(--destructive, hsl(0 84.2% 60%))",
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export { FileUpload };
export type { FileUploadProps };
