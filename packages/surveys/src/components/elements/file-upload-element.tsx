import { useState } from "preact/hooks";
import { useTranslation } from "react-i18next";
import { FileUpload, type UploadedFile } from "@formbricks/survey-ui";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
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

export function FileUploadElement({
  element,
  value,
  onChange,
  languageCode,
  ttc,
  setTtc,
  currentElementId,
}: Readonly<FileUploadElementProps>) {
  const [startTime, setStartTime] = useState(performance.now());
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const isCurrent = element.id === currentElementId;

  useTtc(element.id, ttc, setTtc, startTime, setStartTime, isCurrent);
  const { t } = useTranslation();

  // Convert string[] to UploadedFile[] for survey-ui component
  const convertToUploadedFiles = (urls: string[]): UploadedFile[] => {
    return urls.map((url) => {
      // Extract filename from URL path
      const urlPath = url.split("?")[0]; // Remove query params
      const fileName = urlPath.split("/").pop() || "Unknown file";
      return {
        name: decodeURIComponent(fileName),
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
    const urls = convertToStringArray(files);
    onChange({ [element.id]: urls });
  };

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
    <form key={element.id} onSubmit={handleSubmit} className="fb:w-full">
      <FileUpload
        elementId={element.id}
        inputId={element.id}
        headline={getLocalizedValue(element.headline, languageCode)}
        description={element.subheader ? getLocalizedValue(element.subheader, languageCode) : undefined}
        value={value ? convertToUploadedFiles(value) : undefined}
        onChange={handleChange}
        allowMultiple={element.allowMultipleFiles}
        maxSizeInMB={element.maxSizeInMB}
        allowedFileExtensions={element.allowedFileExtensions}
        required={element.required}
        errorMessage={errorMessage}
        imageUrl={element.imageUrl}
        videoUrl={element.videoUrl}
      />
    </form>
  );
}
