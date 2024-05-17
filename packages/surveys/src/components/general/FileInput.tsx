import { useMemo } from "preact/hooks";
// @ts-expect-error
import { JSXInternal } from "preact/src/jsx";
import { useState } from "react";

import { getOriginalFileNameFromUrl } from "@formbricks/lib/storage/utils";
import { TAllowedFileExtension } from "@formbricks/types/common";
import { TUploadFileConfig } from "@formbricks/types/storage";

interface FileInputProps {
  allowedFileExtensions?: TAllowedFileExtension[];
  surveyId: string | undefined;
  onUploadCallback: (uploadedUrls: string[]) => void;
  onFileUpload: (file: File, config?: TUploadFileConfig) => Promise<string>;
  fileUrls: string[] | undefined;
  maxSizeInMB?: number;
  allowMultipleFiles?: boolean;
  htmlFor?: string;
}

export const FileInput = ({
  allowedFileExtensions,
  surveyId,
  onUploadCallback,
  onFileUpload,
  fileUrls,
  maxSizeInMB,
  allowMultipleFiles,
  htmlFor = "",
}: FileInputProps) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (file: File) => {
    if (file) {
      if (maxSizeInMB) {
        const fileBuffer = await file.arrayBuffer();

        const bufferBytes = fileBuffer.byteLength;
        const bufferKB = bufferBytes / 1024;
        if (bufferKB > maxSizeInMB * 1024) {
          alert(`File should be less than ${maxSizeInMB} MB`);
        } else {
          setIsUploading(true);
          try {
            const response = await onFileUpload(file, { allowedFileExtensions, surveyId });
            setSelectedFiles([...selectedFiles, file]);

            setIsUploading(false);
            if (fileUrls) {
              onUploadCallback([...fileUrls, response]);
            } else {
              onUploadCallback([response]);
            }
          } catch (err: any) {
            setIsUploading(false);
            if (err.name === "FileTooLargeError") {
              alert(err.message);
            } else {
              alert("Upload failed! Please try again.");
            }
          }
        }
      } else {
        setIsUploading(true);

        try {
          const response = await onFileUpload(file, { allowedFileExtensions, surveyId });

          setSelectedFiles([...selectedFiles, file]);
          setIsUploading(false);
          if (fileUrls) {
            onUploadCallback([...fileUrls, response]);
          } else {
            onUploadCallback([response]);
          }
        } catch (err: any) {
          setIsUploading(false);
          if (err.name === "FileTooLargeError") {
            alert(err.message);
          } else {
            alert("Upload failed! Please try again.");
          }
        }
      }
    } else {
      alert("Please select a file");
    }
  };

  const handleDragOver = (e: JSXInternal.TargetedDragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();

    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = async (e: JSXInternal.TargetedDragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files);

    if (!allowMultipleFiles && files.length > 1) {
      alert("Only one file can be uploaded at a time.");
      return;
    }

    if (files.length > 0) {
      const validFiles = files.filter((file) =>
        allowedFileExtensions && allowedFileExtensions.length > 0
          ? allowedFileExtensions.includes(
              // @ts-expect-error
              file.type.substring(file.type.lastIndexOf("/") + 1) as TAllowedFileExtension
            )
          : true
      );

      if (validFiles.length > 0) {
        const uploadedUrls: string[] = [];

        for (const file of validFiles) {
          if (maxSizeInMB) {
            // @ts-expect-error
            const fileBuffer = await file.arrayBuffer();

            const bufferBytes = fileBuffer.byteLength;
            const bufferKB = bufferBytes / 1024;

            if (bufferKB > maxSizeInMB * 1024) {
              alert(`File should be less than ${maxSizeInMB} MB`);
            } else {
              setIsUploading(true);
              try {
                // @ts-expect-error
                const response = await onFileUpload(file, { allowedFileExtensions, surveyId });
                // @ts-expect-error
                setSelectedFiles([...selectedFiles, file]);

                uploadedUrls.push(response);
              } catch (err: any) {
                setIsUploading(false);
                if (err.name === "FileTooLargeError") {
                  alert(err.message);
                } else {
                  alert("Upload failed! Please try again.");
                }
              }
            }
          } else {
            setIsUploading(true);
            try {
              // @ts-expect-error
              const response = await onFileUpload(file, { allowedFileExtensions, surveyId });
              // @ts-expect-error
              setSelectedFiles([...selectedFiles, file]);

              uploadedUrls.push(response);
            } catch (err: any) {
              setIsUploading(false);
              if (err.name === "FileTooLargeError") {
                alert(err.message);
              } else {
                alert("Upload failed! Please try again.");
              }
            }
          }
        }

        setIsUploading(false);
        if (fileUrls) {
          onUploadCallback([...fileUrls, ...uploadedUrls]);
        } else {
          onUploadCallback(uploadedUrls);
        }
      } else {
        alert("no selected files are valid");
      }
    }
  };

  const handleDeleteFile = (index: number, event: JSXInternal.TargetedMouseEvent<SVGSVGElement>) => {
    event.stopPropagation();

    if (fileUrls) {
      const newFiles = [...selectedFiles];
      newFiles.splice(index, 1);
      setSelectedFiles(newFiles);
      const updatedFileUrls = [...fileUrls];
      updatedFileUrls.splice(index, 1);
      onUploadCallback(updatedFileUrls);
    }
  };

  const showUploader = useMemo(() => {
    if (isUploading) {
      return false;
    }

    if (allowMultipleFiles) {
      return true;
    }

    if (fileUrls && fileUrls.length > 0) {
      return false;
    }

    return true;
  }, [allowMultipleFiles, fileUrls, isUploading]);

  const uniqueHtmlFor = useMemo(() => `selectedFile-${htmlFor}`, [htmlFor]);

  return (
    <div
      className={`items-left bg-input-bg hover:bg-input-bg-selected border-border relative mt-3 flex w-full flex-col justify-center rounded-lg border-2 border-dashed dark:border-slate-600 dark:bg-slate-700 dark:hover:border-slate-500 dark:hover:bg-slate-800`}>
      <div>
        {fileUrls &&
          fileUrls?.map((file, index) => {
            const fileName = getOriginalFileNameFromUrl(file);

            return (
              <div key={index} className="bg-input-bg-selected border-border relative m-2 rounded-md border">
                <div className="absolute right-0 top-0 m-2">
                  <div className="bg-survey-bg flex h-5 w-5 cursor-pointer items-center justify-center rounded-md">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 26 26"
                      strokeWidth={1}
                      stroke="currentColor"
                      className="text-heading h-5"
                      onClick={(e) => handleDeleteFile(index, e)}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10 10m0-10L9 19" />
                    </svg>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center p-2">
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
                    class="lucide lucide-file"
                    className="text-heading h-6">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <p className="text-heading mt-1 w-full overflow-hidden overflow-ellipsis whitespace-nowrap px-2 text-center text-sm">
                    {fileName}
                  </p>
                </div>
              </div>
            );
          })}
      </div>

      <div>
        {isUploading && (
          <div className="inset-0 flex animate-pulse items-center justify-center rounded-lg py-4">
            <label htmlFor={uniqueHtmlFor} className="text-subheading text-sm font-medium">
              Uploading...
            </label>
          </div>
        )}

        <label htmlFor={uniqueHtmlFor} onDragOver={(e) => handleDragOver(e)} onDrop={(e) => handleDrop(e)}>
          {showUploader && (
            <div
              className="focus:outline-brand flex flex-col items-center justify-center py-6 hover:cursor-pointer"
              tabIndex={1}
              onKeyDown={(e) => {
                // Accessibility: if spacebar was pressed pass this down to the input
                if (e.key === " ") {
                  e.preventDefault();
                  document.getElementById(uniqueHtmlFor)?.click();
                  document.getElementById(uniqueHtmlFor)?.focus();
                }
              }}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="text-placeholder h-6">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                />
              </svg>

              <p className="text-placeholder mt-2 text-sm dark:text-slate-400">
                <span className="font-medium">Click or drag to upload files.</span>
              </p>
              <input
                type="file"
                id={uniqueHtmlFor}
                name={uniqueHtmlFor}
                accept={allowedFileExtensions?.map((ext) => `.${ext}`).join(",")}
                className="hidden"
                onChange={(e) => {
                  const inputElement = e.target as HTMLInputElement; // Cast e.target to HTMLInputElement
                  if (inputElement.files) {
                    handleFileUpload(inputElement.files[0]);
                  }
                }}
              />
            </div>
          )}
        </label>
      </div>
    </div>
  );
};
