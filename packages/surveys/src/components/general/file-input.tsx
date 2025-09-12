import { FILE_PICK_EVENT } from "@/lib/constants";
import { getOriginalFileNameFromUrl } from "@/lib/storage";
import { getMimeType, isFulfilled, isRejected } from "@/lib/utils";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { type JSXInternal } from "preact/src/jsx";
import { useTranslation } from "react-i18next";
import { type TJsFileUploadParams } from "@formbricks/types/js";
import { TAllowedFileExtension, type TUploadFileConfig, mimeTypes } from "@formbricks/types/storage";

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
}: Readonly<FileInputProps>) {
  const { t } = useTranslation();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [parent] = useAutoAnimate();

  // Helper function to filter duplicate files
  const filterDuplicateFiles = useCallback(
    <T extends { name: string }>(
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
        alert(t("errors.file_input.duplicate_files", { duplicateNames }));
      }

      return { filteredFiles, duplicateFiles };
    },
    [fileUrls, selectedFiles, t]
  );

  // Helper function to filter files by size
  const filterFilesBySize = useCallback(
    (files: { name: string; type: string; base64: string }[]) => {
      if (!maxSizeInMB) return { validFiles: files, rejectedFiles: [] };

      const validFiles: typeof files = [];
      const rejectedFiles: string[] = [];

      for (const file of files) {
        const base64SizeInKB = (file.base64.length * 0.75) / 1024;
        if (base64SizeInKB > maxSizeInMB * 1024) {
          rejectedFiles.push(file.name);
        } else {
          validFiles.push(file);
        }
      }

      return { validFiles, rejectedFiles };
    },
    [maxSizeInMB]
  );

  // Helper function to handle upload errors
  const handleUploadErrors = useCallback((rejected: PromiseRejectedResult[]) => {
    if (rejected.length === 0) return;

    const reason = rejected[0].reason;
    if (reason?.name === "FileTooLargeError") {
      alert(reason.message);
    } else if (reason?.name === "InvalidFileNameError") {
      alert("Invalid file name. Please rename your file and try again.");
    } else {
      alert("Upload failed! Please try again.");
    }
  }, []);

  // Listen for the native file-upload event dispatched via window.formbricksSurveys.onFilePick
  useEffect(() => {
    const handleNativeFileUpload = async (
      event: CustomEvent<{ name: string; type: string; base64: string }[]>
    ) => {
      const filesFromNative = event.detail;

      try {
        setIsUploading(true);

        // Filter files by size
        const { validFiles, rejectedFiles } = filterFilesBySize(filesFromNative);

        // Check for duplicate files
        const { filteredFiles: nonDuplicateFiles } = filterDuplicateFiles(validFiles, false);

        // Show size rejection alert
        if (rejectedFiles.length > 0) {
          const fileNames = rejectedFiles.join(", ");
          alert(t("errors.file_input.file_size_exceeded", { fileNames, maxSizeInMB }));
        }

        // Exit early if no files to upload
        if (nonDuplicateFiles.length === 0) return;

        // Upload files
        const results = await Promise.allSettled(
          nonDuplicateFiles.map((file) => onFileUpload(file, { allowedFileExtensions, surveyId }))
        );

        const fulfilled = results.filter(isFulfilled).map((r) => r.value);
        const rejected = results.filter(isRejected);

        // Update file URLs on success
        if (fulfilled.length) {
          onUploadCallback(fileUrls ? [...fileUrls, ...fulfilled] : fulfilled);
        }

        // Handle upload errors
        handleUploadErrors(rejected);
      } catch (err) {
        console.error(`Error uploading native file.`);
        alert(t("errors.file_input.upload_failed"));
      } finally {
        setIsUploading(false);
      }
    };

    window.addEventListener(FILE_PICK_EVENT, handleNativeFileUpload as unknown as EventListener);
    return () => {
      window.removeEventListener(FILE_PICK_EVENT, handleNativeFileUpload as unknown as EventListener);
    };
  }, [
    allowedFileExtensions,
    fileUrls,
    maxSizeInMB,
    onFileUpload,
    onUploadCallback,
    surveyId,
    filterDuplicateFiles,
    t,
    filterFilesBySize,
    handleUploadErrors,
  ]);

  const toBase64 = (file: File) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
    });

  const validateFileSize = async (file: File): Promise<boolean> => {
    if (maxSizeInMB) {
      const fileBuffer = await file.arrayBuffer();
      const bufferKB = fileBuffer.byteLength / 1024;
      if (bufferKB > maxSizeInMB * 1024) {
        alert(t("errors.file_input.file_size_exceeded_alert", { maxSizeInMB }));
        return false;
      }
    }
    return true;
  };

  // Helper function to validate file limits
  const validateFileLimits = useCallback(
    (fileArray: File[]) => {
      if (!allowMultipleFiles && fileArray.length > 1) {
        alert(t("errors.file_input.only_one_file_can_be_uploaded_at_a_time"));
        return false;
      }

      if (allowMultipleFiles && selectedFiles.length + fileArray.length > FILE_LIMIT) {
        alert(t("errors.file_input.you_can_only_upload_a_maximum_of_files", { FILE_LIMIT }));
        return false;
      }

      return true;
    },
    [allowMultipleFiles, selectedFiles.length, t]
  );

  // Helper function to validate file extensions
  const validateFileExtensions = useCallback(
    (files: File[]) => {
      return files.filter((file) => {
        const fileExtension = file.name.split(".").pop()?.toLowerCase() as TAllowedFileExtension;
        if (!fileExtension || fileExtension === file.name.toLowerCase()) return false;

        if (allowedFileExtensions) {
          return allowedFileExtensions.includes(fileExtension);
        }

        return Object.keys(mimeTypes).includes(fileExtension);
      });
    },
    [allowedFileExtensions]
  );

  // Helper function to convert files to base64 and upload
  const processAndUploadFiles = useCallback(
    async (files: File[]) => {
      const filePromises = files.map(async (file) => {
        const base64 = await toBase64(file);
        return { name: file.name, type: file.type, base64: base64 as string };
      });

      const filesToUpload = await Promise.all(filePromises);
      const uploadPromises = filesToUpload.map((file) =>
        onFileUpload(file, { allowedFileExtensions, surveyId })
      );

      const uploadedFiles = await Promise.allSettled(uploadPromises);
      const rejectedFiles = uploadedFiles.filter(isRejected);
      const uploadedFilesUrl = uploadedFiles.filter(isFulfilled).map((url) => url.value);

      setSelectedFiles((prevFiles) => [...prevFiles, ...files]);
      onUploadCallback(fileUrls ? [...fileUrls, ...uploadedFilesUrl] : uploadedFilesUrl);

      handleUploadErrors(rejectedFiles);
    },
    [onFileUpload, allowedFileExtensions, surveyId, fileUrls, onUploadCallback, handleUploadErrors]
  );

  const handleFileSelection = async (files: FileList) => {
    const fileArray = Array.from(files);

    if (!validateFileLimits(fileArray)) return;

    const { filteredFiles: nonDuplicateFiles } = filterDuplicateFiles(fileArray);
    if (nonDuplicateFiles.length === 0) return;

    const validFiles = validateFileExtensions(nonDuplicateFiles);
    if (!validFiles.length) {
      alert(t("errors.file_input.no_valid_file_types_selected"));
      return;
    }

    const sizeValidatedFiles: File[] = [];
    for (const validFile of validFiles) {
      const isAllowed = await validateFileSize(validFile);
      if (isAllowed) {
        sizeValidatedFiles.push(validFile);
      }
    }

    if (sizeValidatedFiles.length === 0) return;

    try {
      setIsUploading(true);
      await processAndUploadFiles(sizeValidatedFiles);
    } catch (err: any) {
      console.error("error in uploading file: ", err);
      alert(t("errors.file_input.upload_failed"));
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

  const mimeTypeForAllowedFileExtensions = useMemo(() => {
    return allowedFileExtensions?.map((ext) => getMimeType(ext)).join(",");
  }, [allowedFileExtensions]);

  return (
    <div className="fb-bg-input-bg hover:fb-bg-input-bg-selected fb-border-border fb-relative fb-mt-3 fb-flex fb-w-full fb-flex-col fb-justify-center fb-items-center fb-rounded-lg fb-border-2 fb-border-dashed dark:fb-border-slate-600 dark:fb-bg-slate-700 dark:hover:fb-border-slate-500 dark:hover:fb-bg-slate-800">
      <div ref={parent}>
        {fileUrls?.map((fileUrl, index) => {
          const fileName = getOriginalFileNameFromUrl(fileUrl);
          return (
            <div
              key={index}
              aria-label={t("common.you_have_successfully_uploaded_the_file", { fileName })}
              tabIndex={0}
              className="fb-bg-input-bg-selected fb-border-border fb-relative fb-m-2 fb-rounded-md fb-border">
              <div className="fb-absolute fb-right-0 fb-top-0 fb-m-2">
                <button
                  type="button"
                  aria-label={`${t("common.delete_file")} ${fileName}`}
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
              {t("common.uploading")}...
            </label>
          </div>
        ) : null}

        <label htmlFor={uniqueHtmlFor} onDragOver={handleDragOver} onDrop={handleDrop}>
          {showUploader ? (
            <button
              type="button"
              className="focus:fb-outline-brand fb-flex fb-flex-col fb-items-center fb-justify-center fb-py-6 hover:fb-cursor-pointer w-full"
              aria-label={t("common.upload_files_by_clicking_or_dragging_them_here")}
              onClick={() => document.getElementById(uniqueHtmlFor)?.click()}>
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
                {t("common.click_or_drag_to_upload_files")}
              </span>
              <input
                type="file"
                id={uniqueHtmlFor}
                name={uniqueHtmlFor}
                accept={mimeTypeForAllowedFileExtensions}
                className="fb-hidden"
                onChange={async (e) => {
                  const inputElement = e.target as HTMLInputElement;
                  if (inputElement.files) {
                    await handleFileSelection(inputElement.files);
                  }
                }}
                multiple={allowMultipleFiles}
                aria-label={t("common.file_upload")}
                aria-describedby={`${uniqueHtmlFor}-label`}
                data-accept-multiple={allowMultipleFiles}
                data-accept-extensions={mimeTypeForAllowedFileExtensions}
              />
            </button>
          ) : null}
        </label>
      </div>
    </div>
  );
}
