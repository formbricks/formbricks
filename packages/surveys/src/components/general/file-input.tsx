import { FILE_PICK_EVENT } from "@/lib/constants";
import { getOriginalFileNameFromUrl } from "@/lib/storage";
import { getMimeType } from "@/lib/utils";
import { isFulfilled, isRejected } from "@/lib/utils";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import React, { useEffect, useMemo, useState } from "react";
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

  // Helper function to filter duplicate files
  const filterDuplicateFiles = <T extends { name: string }>(
    files: T[],
    checkAgainstSelected: boolean = true
  ): {
    filteredFiles: T[];
    duplicateFiles: T[];
  } => {
    const existingFileNames = fileUrls ? fileUrls.map(getOriginalFileNameFromUrl) : [];

    const duplicateFiles = files.filter(
      (file) =>
        existingFileNames.includes(file.name) ||
        (checkAgainstSelected && selectedFiles.some((selectedFile) => selectedFile.name === file.name))
    );

    const filteredFiles = files.filter(
      (file) =>
        !existingFileNames.includes(file.name) &&
        (!checkAgainstSelected || !selectedFiles.some((selectedFile) => selectedFile.name === file.name))
    );

    if (duplicateFiles.length > 0) {
      const duplicateNames = duplicateFiles.map((file) => file.name).join(", ");
      alert(`The following files are already uploaded: ${duplicateNames}. Duplicate files are not allowed.`);
    }

    return { filteredFiles, duplicateFiles };
  };

  // Listen for the native file-upload event dispatched via window.formbricksSurveys.onFilePick
  useEffect(() => {
    const handleNativeFileUpload = async (
      event: CustomEvent<{ name: string; type: string; base64: string }[]>
    ) => {
      const filesFromNative = event.detail;

      try {
        setIsUploading(true);

        // Filter out files that exceed the maximum size
        let filteredFiles: typeof filesFromNative = [];
        const rejectedFiles: string[] = [];

        if (maxSizeInMB) {
          for (const file of filesFromNative) {
            // Calculate file size from base64 string
            // Base64 size in bytes is roughly 3/4 of the string length
            const base64SizeInKB = (file.base64.length * 0.75) / 1024;

            if (base64SizeInKB > maxSizeInMB * 1024) {
              rejectedFiles.push(file.name);
            } else {
              filteredFiles.push(file);
            }
          }
        } else {
          // If no size limit is specified, use all files
          filteredFiles.push(...filesFromNative);
        }

        // Check for duplicate files - native uploads don't need to check against selectedFiles
        const { filteredFiles: nonDuplicateFiles } = filterDuplicateFiles(filteredFiles, false);
        filteredFiles = nonDuplicateFiles;

        // Display alert for rejected files
        if (rejectedFiles.length > 0) {
          const fileNames = rejectedFiles.join(", ");
          alert(
            `The following file(s) exceed the maximum size of ${maxSizeInMB} MB and were removed: ${fileNames}`
          );
        }

        // If no files remain after filtering, exit early
        if (filteredFiles.length === 0) {
          return;
        }

        const uploadedUrls = await Promise.all(
          filteredFiles.map((file) => onFileUpload(file, { allowedFileExtensions, surveyId }))
        );

        // Update file URLs by appending the new URL
        onUploadCallback(fileUrls ? [...fileUrls, ...uploadedUrls] : uploadedUrls);
      } catch (err) {
        console.error(`Error uploading native file.`);
        alert(`Upload failed! Please try again.`);
      } finally {
        setIsUploading(false);
      }
    };

    window.addEventListener(FILE_PICK_EVENT, handleNativeFileUpload as unknown as EventListener);
    return () => {
      window.removeEventListener(FILE_PICK_EVENT, handleNativeFileUpload as unknown as EventListener);
    };
  }, [allowedFileExtensions, fileUrls, maxSizeInMB, onFileUpload, onUploadCallback, surveyId]);

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
    let fileArray = Array.from(files);

    if (!allowMultipleFiles && fileArray.length > 1) {
      alert("Only one file can be uploaded at a time.");
      return;
    }

    if (allowMultipleFiles && selectedFiles.length + fileArray.length > FILE_LIMIT) {
      alert(`You can only upload a maximum of ${FILE_LIMIT.toString()} files.`);
      return;
    }

    // Check for duplicate files
    const { filteredFiles: nonDuplicateFiles } = filterDuplicateFiles(fileArray);

    if (nonDuplicateFiles.length === 0) {
      return; // No non-duplicate files to process
    }

    fileArray = nonDuplicateFiles;

    // filter out files that are not allowed
    const validFiles = fileArray.filter((file) => {
      const fileExtension = file.type.substring(file.type.lastIndexOf("/") + 1) as TAllowedFileExtension;
      if (allowedFileExtensions) {
        return allowedFileExtensions.includes(fileExtension);
      }
      return true;
    });

    if (!validFiles.length) {
      alert("No valid file types selected. Please select a valid file type.");
      return;
    }

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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // @ts-expect-error -- TS does not recognize dataTransfer
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // @ts-expect-error -- TS does not recognize dataTransfer
    await handleFileSelection(e.dataTransfer.files);
  };

  const handleDeleteFile = (index: number, event: React.DragEvent) => {
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

  const mimeTypeForAllowedFileExtensions = useMemo(() => {
    return allowedFileExtensions?.map((ext) => getMimeType(ext)).join(",");
  }, [allowedFileExtensions]);

  return (
    <div className="items-left bg-input-bg hover:bg-input-bg-selected border-border relative mt-3 flex w-full flex-col justify-center rounded-lg border-2 border-dashed dark:border-slate-600 dark:bg-slate-700 dark:hover:border-slate-500 dark:hover:bg-slate-800">
      <div ref={parent}>
        {fileUrls?.map((fileUrl, index) => {
          const fileName = getOriginalFileNameFromUrl(fileUrl);
          return (
            <div
              key={index}
              aria-label={`You've successfully uploaded the file ${fileName}`}
              tabIndex={0}
              className="bg-input-bg-selected border-border relative m-2 rounded-md border">
              <div className="absolute right-0 top-0 m-2">
                <button
                  type="button"
                  aria-label={`Delete file ${fileName}`}
                  className="bg-survey-bg flex h-5 w-5 cursor-pointer items-center justify-center rounded-md">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 26 26"
                    strokeWidth={1}
                    stroke="currentColor"
                    className="text-heading h-5"
                    onClick={(e) => {
                      handleDeleteFile(index, e);
                    }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10 10m0-10L9 19" />
                  </svg>
                </button>
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
                  className="text-heading h-6"
                  aria-hidden="true">
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
        {isUploading ? (
          <div className="inset-0 flex animate-pulse items-center justify-center rounded-lg py-4">
            <label htmlFor={uniqueHtmlFor} className="text-subheading text-sm font-medium">
              Uploading...
            </label>
          </div>
        ) : null}

        <label htmlFor={uniqueHtmlFor} onDragOver={handleDragOver} onDrop={handleDrop}>
          {showUploader ? (
            <div
              className="focus:outline-brand flex w-full flex-col items-center justify-center py-6 hover:cursor-pointer"
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
                className="text-placeholder h-6"
                aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                />
              </svg>
              <label
                className="text-placeholder mt-2 text-sm dark:text-slate-400"
                id={`${uniqueHtmlFor}-label`}>
                Click or drag to upload files.
              </label>
              <input
                type="file"
                id={uniqueHtmlFor}
                name={uniqueHtmlFor}
                accept={mimeTypeForAllowedFileExtensions}
                className="hidden"
                onChange={async (e) => {
                  const inputElement = e.target as HTMLInputElement;
                  if (inputElement.files) {
                    await handleFileSelection(inputElement.files);
                  }
                }}
                multiple={allowMultipleFiles}
                aria-label="File upload"
                aria-describedby={`${uniqueHtmlFor}-label`}
                data-accept-multiple={allowMultipleFiles}
                data-accept-extensions={mimeTypeForAllowedFileExtensions}
              />
            </div>
          ) : null}
        </label>
      </div>
    </div>
  );
}
