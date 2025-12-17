import { useCallback, useState } from "preact/hooks";
import { useTranslation } from "react-i18next";
import { FileUpload, type UploadedFile } from "@formbricks/survey-ui";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TAllowedFileExtension } from "@formbricks/types/storage";
import type { TSurveyFileUploadElement } from "@formbricks/types/surveys/elements";
import { getLocalizedValue } from "@/lib/i18n";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";

interface FileUploadElementProps {
  element: TSurveyFileUploadElement;
  value: string[];
  onChange: (responseData: TResponseData) => void;
  onFileUpload: (file: any, config?: any) => Promise<string>;
  surveyId: string;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  autoFocusEnabled: boolean;
  currentElementId: string;
}

const FILE_LIMIT = 25;

export function FileUploadElement({
  element,
  value,
  onChange,
  onFileUpload,
  surveyId,
  languageCode,
  ttc,
  setTtc,
  currentElementId,
}: Readonly<FileUploadElementProps>) {
  const [startTime, setStartTime] = useState(performance.now());
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [isUploading, setIsUploading] = useState(false);
  const isCurrent = element.id === currentElementId;

  useTtc(element.id, ttc, setTtc, startTime, setStartTime, isCurrent);
  const { t } = useTranslation();
  const [fileNames, setFileNames] = useState<Record<string, string>>({});

  // Convert string[] to UploadedFile[] for survey-ui component
  const convertToUploadedFiles = (urls: string[]): UploadedFile[] => {
    return urls.map((url) => {
      // Check if we have the name stored locally
      if (fileNames[url]) {
        return {
          name: fileNames[url],
          url,
        };
      }

      // Extract filename from URL path
      const urlPath = url.split("?")[0]; // Remove query params
      let fileName = urlPath.split("/").pop() || "Unknown file";

      try {
        fileName = decodeURIComponent(fileName);
      } catch (e) {
        console.error(`Error decoding file name: ${e}`);
      }

      // Clean up Formbricks storage pattern: name--fid--uuid.ext
      if (fileName.includes("--fid--")) {
        const parts = fileName.split("--fid--");
        const extension = fileName.split(".").pop();
        if (parts[0] && extension) {
          fileName = `${parts[0]}.${extension}`;
        }
      }

      return {
        name: fileName,
        url,
      };
    });
  };

  // Convert UploadedFile[] to string[] for the onChange callback
  const convertToStringArray = (files: UploadedFile[]): string[] => {
    return files.map((file) => file.url);
  };

  const handleChange = (files: UploadedFile[]) => {
    // Clear error when user uploads files
    setErrorMessage(undefined);

    // Store names locally
    const newFileNames: Record<string, string> = {};
    files.forEach((f) => {
      newFileNames[f.url] = f.name;
    });
    setFileNames((prev) => ({ ...prev, ...newFileNames }));

    const urls = convertToStringArray(files);
    onChange({ [element.id]: urls });
  };

  /**
   * Convert File to base64
   */
  const toBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });

  /**
   * Filter duplicate files
   */
  const filterDuplicateFiles = useCallback(
    (files: File[]): { filteredFiles: File[]; duplicateFiles: File[] } => {
      const existingFileNames = new Set(
        (value || []).map((url) => {
          const fileName = fileNames[url] || url.split("/").pop() || "";
          return fileName.toLowerCase();
        })
      );

      const duplicateFiles = files.filter((file) => existingFileNames.has(file.name.toLowerCase()));

      const filteredFiles = files.filter((file) => !existingFileNames.has(file.name.toLowerCase()));

      if (duplicateFiles.length > 0) {
        const duplicateNames = duplicateFiles.map((file) => file.name).join(", ");
        setErrorMessage(t("errors.file_input.duplicate_files", { duplicateNames }));
      }

      return { filteredFiles, duplicateFiles };
    },
    [value, fileNames, t]
  );

  /**
   * Validate file extension
   */
  const validateFileExtension = useCallback(
    (file: File): boolean => {
      if (!element.allowedFileExtensions || element.allowedFileExtensions.length === 0) {
        return true; // No restrictions
      }

      const fileExtensionPart = file.name.split(".").pop()?.toLowerCase();
      if (!fileExtensionPart) {
        return false; // No extension
      }

      return element.allowedFileExtensions.includes(fileExtensionPart as TAllowedFileExtension);
    },
    [element.allowedFileExtensions]
  );

  /**
   * Validate file size
   */
  const validateFileSize = useCallback(
    async (file: File): Promise<boolean> => {
      if (!element.maxSizeInMB) {
        return true; // No size restriction
      }

      const fileSizeInMB = file.size / (1024 * 1024);
      if (fileSizeInMB > element.maxSizeInMB) {
        setErrorMessage(
          t("errors.file_input.file_size_exceeded_alert", { maxSizeInMB: element.maxSizeInMB })
        );
        return false;
      }

      return true;
    },
    [element.maxSizeInMB, t]
  );

  /**
   * Validate file limits
   */
  const validateFileLimits = useCallback(
    (fileArray: File[]): boolean => {
      if (!element.allowMultipleFiles && fileArray.length > 1) {
        setErrorMessage(t("errors.file_input.only_one_file_can_be_uploaded_at_a_time"));
        return false;
      }

      if (element.allowMultipleFiles && (value?.length || 0) + fileArray.length > FILE_LIMIT) {
        setErrorMessage(t("errors.file_input.you_can_only_upload_a_maximum_of_files", { FILE_LIMIT }));
        return false;
      }

      return true;
    },
    [element.allowMultipleFiles, value, t]
  );

  /**
   * Validates and filters files by extension and size
   */
  const validateAndFilterFiles = useCallback(
    async (files: File[]): Promise<{ filesToUpload: File[]; sizeRejectedFiles: string[] }> => {
      const validFiles = files.filter((file) => validateFileExtension(file));
      if (validFiles.length === 0) {
        setErrorMessage(t("errors.file_input.no_valid_file_types_selected"));
        return { filesToUpload: [], sizeRejectedFiles: [] };
      }

      const filesToUpload: File[] = [];
      const sizeRejectedFiles: string[] = [];

      for (const file of validFiles) {
        const isValidSize = await validateFileSize(file);
        if (isValidSize) {
          filesToUpload.push(file);
        } else {
          sizeRejectedFiles.push(file.name);
        }
      }

      if (sizeRejectedFiles.length > 0 && element.maxSizeInMB) {
        const fileNames = sizeRejectedFiles.join(", ");
        setErrorMessage(
          t("errors.file_input.file_size_exceeded", { fileNames, maxSizeInMB: element.maxSizeInMB })
        );
      }

      return { filesToUpload, sizeRejectedFiles };
    },
    [validateFileExtension, validateFileSize, element.maxSizeInMB, t]
  );

  /**
   * Uploads files and updates state
   */
  const uploadFiles = useCallback(
    async (filesToUpload: File[]): Promise<void> => {
      setIsUploading(true);

      try {
        // Convert files to base64 and upload
        const uploadPromises = filesToUpload.map(async (file) => {
          const base64 = await toBase64(file);
          const uploadedUrl = await onFileUpload(
            {
              name: file.name,
              type: file.type,
              base64,
            },
            {
              allowedFileExtensions: element.allowedFileExtensions,
              surveyId,
            }
          );
          return { name: file.name, url: uploadedUrl };
        });

        const uploadedFiles = await Promise.all(uploadPromises);

        // Store file names
        const newFileNames: Record<string, string> = {};
        uploadedFiles.forEach((f) => {
          newFileNames[f.url] = f.name;
        });
        setFileNames((prev) => ({ ...prev, ...newFileNames }));

        // Update value
        const newUrls = uploadedFiles.map((f) => f.url);
        if (element.allowMultipleFiles) {
          onChange({ [element.id]: [...(value || []), ...newUrls] });
        } else {
          onChange({ [element.id]: newUrls.slice(0, 1) });
        }

        // Clear error on success
        setErrorMessage(undefined);
      } catch (err: any) {
        // Handle upload errors
        if (err?.name === "FileTooLargeError") {
          setErrorMessage(err.message);
        } else if (err?.name === "InvalidFileNameError") {
          setErrorMessage(t("errors.file_input.upload_failed"));
        } else {
          setErrorMessage(t("errors.file_input.upload_failed"));
        }
      } finally {
        setIsUploading(false);
      }
    },
    [element, surveyId, value, onChange, onFileUpload, t]
  );

  /**
   * Handle file selection and validation
   */
  const handleFileSelect = useCallback(
    async (files: FileList): Promise<void> => {
      // Clear previous errors
      setErrorMessage(undefined);

      const fileArray = Array.from(files);

      // Validate file limits first
      if (!validateFileLimits(fileArray)) {
        return;
      }

      // Filter duplicate files
      const { filteredFiles } = filterDuplicateFiles(fileArray);
      if (filteredFiles.length === 0) {
        return; // All files were duplicates
      }

      // Validate and filter files by extension and size
      const { filesToUpload } = await validateAndFilterFiles(filteredFiles);
      if (filesToUpload.length === 0) {
        return; // No valid files to upload
      }

      // Upload files
      await uploadFiles(filesToUpload);
    },
    [validateFileLimits, filterDuplicateFiles, validateAndFilterFiles, uploadFiles]
  );

  const validateRequired = (): boolean => {
    if (element.required && (!value || value.length === 0)) {
      setErrorMessage(t("errors.please_upload_a_file"));
      return false;
    }
    return true;
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (!validateRequired()) return;

    const updatedTtcObj = getUpdatedTtc(ttc, element.id, performance.now() - startTime);
    setTtc(updatedTtcObj);
  };

  return (
    <form key={element.id} onSubmit={handleSubmit} className="w-full">
      <FileUpload
        elementId={element.id}
        inputId={element.id}
        headline={getLocalizedValue(element.headline, languageCode)}
        description={element.subheader ? getLocalizedValue(element.subheader, languageCode) : undefined}
        value={value ? convertToUploadedFiles(value) : undefined}
        onChange={handleChange}
        onFileSelect={handleFileSelect}
        allowMultiple={element.allowMultipleFiles}
        allowedFileExtensions={element.allowedFileExtensions}
        required={element.required}
        errorMessage={errorMessage}
        isUploading={isUploading}
        imageUrl={element.imageUrl}
        videoUrl={element.videoUrl}
      />
    </form>
  );
}
