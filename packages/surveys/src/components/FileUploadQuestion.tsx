import { TResponseData } from "@formbricks/types/responses";
import type { TSurveyFileUploadQuestion } from "@formbricks/types/surveys";
import { BackButton } from "./BackButton";
import Headline from "./Headline";
import Subheader from "./Subheader";
import SubmitButton from "./SubmitButton";
import FileInput from "./ui/FileInput";
import MultipleFileInput from "./ui/MultipleFileInput";

interface FileUploadQuestionProps {
  question: TSurveyFileUploadQuestion;
  value: string | number | string[];
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  brandColor: string;
  surveyId?: string;
}

export default function FileUploadQuestion({
  question,
  value,
  onChange,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  brandColor,
  surveyId,
}: FileUploadQuestionProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (question.required) {
          if (value && (typeof value === "string" || Array.isArray(value)) && value.length > 0) {
            onSubmit({ [question.id]: value });
          } else {
            alert("Please upload a file");
          }
        } else {
          if (value) {
            onSubmit({ [question.id]: value });
          } else {
            onSubmit({ [question.id]: "skipped" });
          }
        }
      }}
      className="w-full">
      <Headline headline={question.headline} questionId={question.id} required={question.required} />
      <Subheader subheader={question.subheader} questionId={question.id} />

      {question.allowMultipleFile ? (
        <MultipleFileInput
          surveyId={surveyId}
          onFileUpload={(url: string[]) => {
            onChange({ [question.id]: url });
          }}
          fileUrls={value as string[]}
          {...(question.limitFileType && question.allowedFileTypes !== undefined
            ? { allowedFileExtensions: question.allowedFileTypes }
            : {})}
          {...(question.limitSize && question.maxSize !== undefined ? { maxSize: question.maxSize } : {})}
        />
      ) : (
        <FileInput
          surveyId={surveyId}
          onFileUpload={(url: string | undefined) => {
            if (url) {
              onChange({ [question.id]: url });
            } else {
              onChange({ [question.id]: "skipped" });
            }
          }}
          fileUrl={value as string}
          {...(question.limitFileType && question.allowedFileTypes !== undefined
            ? { allowedFileExtensions: question.allowedFileTypes }
            : {})}
          {...(question.limitSize && question.maxSize !== undefined ? { maxSize: question.maxSize } : {})}
        />
      )}

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
        <SubmitButton
          buttonLabel={question.buttonLabel}
          isLastQuestion={isLastQuestion}
          brandColor={brandColor}
          onClick={() => {}}
        />
      </div>
    </form>
  );
}
