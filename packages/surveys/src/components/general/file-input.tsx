import { useAutoAnimate } from "@formkit/auto-animate/react";
import { useMemo, useState } from "preact/hooks";
import { type JSXInternal } from "preact/src/jsx";
import { getOriginalFileNameFromUrl } from "@formbricks/lib/storage/utils";
import { isFulfilled, isRejected } from "@formbricks/lib/utils/promises";
import { type TAllowedFileExtension } from "@formbricks/types/common";
import { type TJsFileUploadParams } from "@formbricks/types/js";
import { type TUploadFileConfig } from "@formbricks/types/storage";

interface FileInputProps {
  allowedFileExtensions?: TAllowedFileExtension[];
  surveyId: string | undefined;
  onUploadCallback: (uploadedUrls: string[]) => void;
  onFileUpload: (file: TJsFileUploadParams["file"], config?: TUploadFileConfig) => Promise<string>;
  fileUrls: string[] | undefined;
  maxSizeInMB?: number;
  allowMultipleFiles?: boolean;
  htmlFor?: string;
}

const FILE_LIMIT = 25;

export function FileInput({
  allowedFileExtensions,
  surveyId,
  onFileUpload,
  onUploadCallback,
  fileUrls,
  maxSizeInMB,
  allowMultipleFiles,
  htmlFor = "",
}: FileInputProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [parent] = useAutoAnimate();

  const validateFileSize = async (file: File): Promise<boolean> => {
    if (maxSizeInMB) {
      const fileBuffer = await file.arrayBuffer();
      const bufferKB = fileBuffer.byteLength / 1024;
      if (bufferKB > maxSizeInMB * 1024) {
        alert(`File should be less than ${maxSizeInMB.toString()} MB`);
        return false;
      }
    }
    return true;
  };

  const handleFileSelection = async (files: FileList) => {
    const fileArray = Array.from(files);

    if (!allowMultipleFiles && fileArray.length > 1) {
      alert("Only one file can be uploaded at a time.");
      return;
    }

    if (allowMultipleFiles && selectedFiles.length + fileArray.length > FILE_LIMIT) {
      alert(`You can only upload a maximum of ${FILE_LIMIT.toString()} files.`);
      return;
    }

    // filter out files that are not allowed
    const validFiles = Array.from(files).filter((file) => {
      const fileExtension = file.type.substring(file.type.lastIndexOf("/") + 1) as TAllowedFileExtension;
      if (allowedFileExtensions) {
        return allowedFileExtensions.includes(fileExtension);
      }
      return true;
    });

    const filteredFiles: File[] = [];

    for (const validFile of validFiles) {
      const isAllowed = await validateFileSize(validFile);
      if (isAllowed) {
        filteredFiles.push(validFile);
      }
    }

    try {
      setIsUploading(true);
      const toBase64 = (file: File) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => {
            resolve(reader.result);
          };
          reader.onerror = reject;
        });

      const filePromises = filteredFiles.map(async (file) => {
        const base64 = await toBase64(file);
        return { name: file.name, type: file.type, base64: base64 as string };
      });

      const filesToUpload = await Promise.all(filePromises);
      const uploadPromises = filesToUpload.map((file) => {
        return onFileUpload(file, { allowedFileExtensions, surveyId });
      });

      const uploadedFiles = await Promise.allSettled(uploadPromises);

      const rejectedFiles = uploadedFiles.filter(isRejected);
      const uploadedFilesUrl = uploadedFiles.filter(isFulfilled).map((url) => url.value);

      setSelectedFiles((prevFiles) => [...prevFiles, ...filteredFiles]);
      onUploadCallback(fileUrls ? [...fileUrls, ...uploadedFilesUrl] : uploadedFilesUrl);

      if (rejectedFiles.length > 0) {
        if (rejectedFiles[0].reason?.name === "FileTooLargeError") {
          alert(rejectedFiles[0].reason.message);
        }
      }
    } catch (err: any) {
      console.error("error in uploading file: ", err);
      alert("Upload failed! Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: JSXInternal.TargetedDragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // @ts-expect-error -- TS does not recognize dataTransfer
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = async (e: JSXInternal.TargetedDragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();

    // @ts-expect-error -- TS does not recognize dataTransfer
    await handleFileSelection(e.dataTransfer.files);
  };

  const handleDeleteFile = (index: number, event: JSXInternal.TargetedMouseEvent<SVGSVGElement>) => {
    event.stopPropagation();
    setSelectedFiles((prevFiles) => {
      const newFiles = [...prevFiles];
      newFiles.splice(index, 1);
      return newFiles;
    });
    if (fileUrls) {
      const updatedFileUrls = [...fileUrls];
      updatedFileUrls.splice(index, 1);
      onUploadCallback(updatedFileUrls);
    }
  };

  const showUploader = useMemo(() => {
    if (isUploading) return false;
    if (allowMultipleFiles) return true;
    return !(fileUrls && fileUrls.length > 0);
  }, [allowMultipleFiles, fileUrls, isUploading]);

  const uniqueHtmlFor = useMemo(() => `selectedFile-${htmlFor}`, [htmlFor]);

  return (
    <div className="fb-items-left fb-bg-input-bg hover:fb-bg-input-bg-selected fb-border-border fb-relative fb-mt-3 fb-flex fb-w-full fb-flex-col fb-justify-center fb-rounded-lg fb-border-2 fb-border-dashed dark:fb-border-slate-600 dark:fb-bg-slate-700 dark:hover:fb-border-slate-500 dark:hover:fb-bg-slate-800">
      <div ref={parent}>
        {fileUrls?.map((fileUrl, index) => {
          const fileName = getOriginalFileNameFromUrl(fileUrl);
          return (
            <div
              key={index}
              aria-label={`You've successfully uploaded the file ${fileName}`}
              tabIndex={0}
              className="fb-bg-input-bg-selected fb-border-border fb-relative fb-m-2 fb-rounded-md fb-border">
              <div className="fb-absolute fb-right-0 fb-top-0 fb-m-2">
                <button
                  type="button"
                  aria-label={`Delete file ${fileName}`}
                  className="fb-bg-survey-bg fb-flex fb-h-5 fb-w-5 fb-cursor-pointer fb-items-center fb-justify-center fb-rounded-md">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 26 26"
                    strokeWidth={1}
                    stroke="currentColor"
                    className="fb-text-heading fb-h-5"
                    onClick={(e) => {
                      handleDeleteFile(index, e);
                    }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10 10m0-10L9 19" />
                  </svg>
                </button>
              </div>
              <div className="fb-flex fb-flex-col fb-items-center fb-justify-center fb-p-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="fb-text-heading fb-h-6"
                  aria-hidden="true">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <p className="fb-text-heading fb-mt-1 fb-w-full fb-overflow-hidden fb-overflow-ellipsis fb-whitespace-nowrap fb-px-2 fb-text-center fb-text-sm">
                  {fileName}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div>
        {isUploading ? (
          <div className="fb-inset-0 fb-flex fb-animate-pulse fb-items-center fb-justify-center fb-rounded-lg fb-py-4">
            <label htmlFor={uniqueHtmlFor} className="fb-text-subheading fb-text-sm fb-font-medium">
              Uploading...
            </label>
          </div>
        ) : null}

        <label htmlFor={uniqueHtmlFor} onDragOver={handleDragOver} onDrop={handleDrop}>
          {showUploader ? (
            <div
              className="focus:fb-outline-brand fb-flex fb-flex-col fb-items-center fb-justify-center fb-py-6 hover:fb-cursor-pointer w-full"
              role="button"
              aria-label="Upload files by clicking or dragging them here"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  document.getElementById(uniqueHtmlFor)?.click();
                }
              }}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="fb-text-placeholder fb-h-6"
                aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                />
              </svg>
              <span
                className="fb-text-placeholder fb-mt-2 fb-text-sm dark:fb-text-slate-400"
                id={`${uniqueHtmlFor}-label`}>
                Click or drag to upload files.
              </span>
              <input
                type="file"
                id={uniqueHtmlFor}
                name={uniqueHtmlFor}
                accept={allowedFileExtensions?.map((ext) => `.${ext}`).join(",")}
                className="fb-hidden"
                onChange={async (e) => {
                  const inputElement = e.target as HTMLInputElement;
                  if (inputElement.files) {
                    await handleFileSelection(inputElement.files);
                  }
                }}
                multiple={allowMultipleFiles}
                aria-label="File upload"
                aria-describedby={`${uniqueHtmlFor}-label`}
              />
            </div>
          ) : null}
        </label>
      </div>
    </div>
  );
}
