import { TResponseData, TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyFileUploadQuestion } from "@formbricks/types/surveys";
import { BackButton } from "../buttons/BackButton";
import SubmitButton from "../buttons/SubmitButton";
import FileInput from "../general/FileInput";
import Headline from "../general/Headline";
import Subheader from "../general/Subheader";
import { TUploadFileConfig } from "@formbricks/types/storage";
import { useEffect, useState } from "preact/hooks";
import { getUpdatedTtcObj } from "@/lib/utils";

interface FileUploadQuestionProps {
  question: TSurveyFileUploadQuestion;
  value: string | number | string[];
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData, ttc: TResponseTtc) => void;
  onBack: () => void;
  onFileUpload: (file: File, config?: TUploadFileConfig) => Promise<string>;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  surveyId: string;
  ttcObj: TResponseTtc;
  setTtcObj: (ttc: TResponseTtc) => void;
}

export default function FileUploadQuestion({
  question,
  value,
  onChange,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  surveyId,
  onFileUpload,
  ttcObj,
  setTtcObj,
}: FileUploadQuestionProps) {
  const [startTime, setStartTime] = useState(performance.now());

  useEffect(() => {
    setStartTime(performance.now());
  }, [question.id]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Restart the timer when the tab becomes visible again
        setStartTime(performance.now());
      } else {
        const updatedTtcObj = getUpdatedTtcObj(ttcObj, question.id, performance.now() - startTime);
        setTtcObj(updatedTtcObj);
      }
    };

    // Attach the event listener
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      // Clean up the event listener when the component is unmounted
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const updatedTtcObj = getUpdatedTtcObj(ttcObj, question.id, performance.now() - startTime);
        setTtcObj(updatedTtcObj);
        if (question.required) {
          if (value && (typeof value === "string" || Array.isArray(value)) && value.length > 0) {
            onSubmit({ [question.id]: typeof value === "string" ? [value] : value }, updatedTtcObj);
          } else {
            alert("Please upload a file");
          }
        } else {
          if (value) {
            onSubmit({ [question.id]: typeof value === "string" ? [value] : value }, updatedTtcObj);
          } else {
            onSubmit({ [question.id]: "skipped" }, updatedTtcObj);
          }
        }
      }}
      className="w-full">
      <Headline headline={question.headline} questionId={question.id} required={question.required} />
      <Subheader subheader={question.subheader} questionId={question.id} />

      <FileInput
        surveyId={surveyId}
        onFileUpload={onFileUpload}
        onUploadCallback={(urls: string[]) => {
          if (urls) {
            onChange({ [question.id]: urls });
          } else {
            onChange({ [question.id]: "skipped" });
          }
        }}
        fileUrls={value as string[]}
        allowMultipleFiles={question.allowMultipleFiles}
        {...(!!question.allowedFileExtensions
          ? { allowedFileExtensions: question.allowedFileExtensions }
          : {})}
        {...(!!question.maxSizeInMB ? { maxSizeInMB: question.maxSizeInMB } : {})}
      />

      <div className="mt-4 flex w-full justify-between">
        {!isFirstQuestion && (
          <BackButton
            backButtonLabel={question.backButtonLabel}
            onClick={() => {
              onBack();
            }}
          />
        )}
        <div></div>
        <SubmitButton buttonLabel={question.buttonLabel} isLastQuestion={isLastQuestion} onClick={() => {}} />
      </div>
    </form>
  );
}
