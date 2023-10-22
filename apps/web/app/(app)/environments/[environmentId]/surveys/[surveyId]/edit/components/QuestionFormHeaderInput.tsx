"use client";

import { QuestionFormInput } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/components/QuestionFormInput";
import { TSurveyQuestion } from "@formbricks/types/surveys";
import FileInput from "@formbricks/ui/FileInput";
import { Label } from "@formbricks/ui/Label";
import { ImagePlusIcon } from "lucide-react";
import { RefObject, useState } from "react";

interface QuestionFormHeaderInputProps {
  question: TSurveyQuestion;
  questionsBeforeCurrent: TSurveyQuestion[];
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  isInValid: boolean;
  environmentId: string;
  ref?: RefObject<HTMLInputElement>;
}

const QuestionFormHeaderInput = ({
  question,
  questionIdx,
  updateQuestion,
  isInValid,
  environmentId,
  questionsBeforeCurrent,
  ref,
}: QuestionFormHeaderInputProps) => {
  const [showImageUploader, setShowImageUploader] = useState<boolean>(!!question.imageUrl);

  return (
    <div className="mt-3">
      <Label htmlFor="headline">Question</Label>
      <div className="mt-2 flex flex-col gap-6">
        {showImageUploader && (
          <FileInput
            allowedFileExtensions={["png", "jpeg", "jpg"]}
            environmentId={environmentId}
            onFileUpload={(url: string) => {
              updateQuestion(questionIdx, { imageUrl: url });
            }}
            fileUrl={question.imageUrl || ""}
          />
        )}
        <div className="flex items-center space-x-2">
          <QuestionFormInput
            questionsBeforeCurrent={questionsBeforeCurrent}
            question={question}
            questionIdx={questionIdx}
            updateProperty="headline"
            updateQuestion={updateQuestion}
            onInputChange={(val) => {
              updateQuestion(questionIdx, {
                headline: val,
              });
            }}
            inputProps={{
              id: "headline",
              name: "headline",
              value: question.headline,
              autoFocus: true,
              ref,
              isInvalid: isInValid && question.headline.trim() === "",
            }}
          />
          <ImagePlusIcon
            aria-label="Toggle image uploader"
            className="ml-2 h-4 w-4 cursor-pointer text-slate-400 hover:text-slate-500"
            onClick={() => setShowImageUploader((prev) => !prev)}
          />
        </div>
      </div>
    </div>
  );
};

export default QuestionFormHeaderInput;
