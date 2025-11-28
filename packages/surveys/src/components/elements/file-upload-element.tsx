import { useState } from "preact/hooks";
import { useTranslation } from "react-i18next";
import { type TJsFileUploadParams } from "@formbricks/types/js";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import { type TUploadFileConfig } from "@formbricks/types/storage";
import type { TSurveyFileUploadElement } from "@formbricks/types/surveys/elements";
import { ElementMedia } from "@/components/general/element-media";
import { Headline } from "@/components/general/headline";
import { getLocalizedValue } from "@/lib/i18n";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { FileInput } from "../general/file-input";
import { Subheader } from "../general/subheader";

interface FileUploadElementProps {
  element: TSurveyFileUploadElement;
  value: string[];
  onChange: (responseData: TResponseData) => void;
  onFileUpload: (file: TJsFileUploadParams["file"], config?: TUploadFileConfig) => Promise<string>;
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
  surveyId,
  onFileUpload,
  languageCode,
  ttc,
  setTtc,
  currentElementId,
}: Readonly<FileUploadElementProps>) {
  const { t } = useTranslation();
  const [startTime, setStartTime] = useState(performance.now());
  const isMediaAvailable = element.imageUrl || element.videoUrl;
  useTtc(element.id, ttc, setTtc, startTime, setStartTime, element.id === currentElementId);

  return (
    <form
      key={element.id}
      onSubmit={(e) => {
        e.preventDefault();
        const updatedTtcObj = getUpdatedTtc(ttc, element.id, performance.now() - startTime);
        setTtc(updatedTtcObj);
        if (element.required) {
          if (!(value && value.length > 0)) {
            alert(t("errors.please_upload_a_file"));
          }
        }
      }}
      className="fb-w-full">
      {isMediaAvailable ? <ElementMedia imgUrl={element.imageUrl} videoUrl={element.videoUrl} /> : null}
      <Headline
        headline={getLocalizedValue(element.headline, languageCode)}
        elementId={element.id}
        required={element.required}
      />
      <Subheader
        subheader={element.subheader ? getLocalizedValue(element.subheader, languageCode) : ""}
        elementId={element.id}
      />
      <FileInput
        htmlFor={element.id}
        surveyId={surveyId}
        onFileUpload={onFileUpload}
        onUploadCallback={(urls: string[]) => {
          if (urls) {
            onChange({ [element.id]: urls });
          } else {
            onChange({ [element.id]: "skipped" });
          }
        }}
        fileUrls={value}
        allowMultipleFiles={element.allowMultipleFiles}
        {...(element.allowedFileExtensions ? { allowedFileExtensions: element.allowedFileExtensions } : {})}
        {...(element.maxSizeInMB ? { maxSizeInMB: element.maxSizeInMB } : {})}
      />
    </form>
  );
}
