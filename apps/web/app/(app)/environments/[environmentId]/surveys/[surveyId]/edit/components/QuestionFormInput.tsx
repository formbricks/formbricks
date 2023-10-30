"use client";

import { TSurveyQuestion } from "@formbricks/types/surveys";
import FileInput from "@formbricks/ui/FileInput";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import { ImagePlusIcon } from "lucide-react";
import { RefObject, useState } from "react";

interface QuestionFormInputProps {
  question: TSurveyQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  isInValid: boolean;
  environmentId: string;
  ref?: RefObject<HTMLInputElement>;
}

const QuestionFormInput = ({
  question,
  questionIdx,
  updateQuestion,
  isInValid,
  environmentId,
  ref,
}: QuestionFormInputProps) => {
  const [showImageUploader, setShowImageUploader] = useState<boolean>(!!question.imageUrl);

  return (
    <div className="mt-3">
      <Label htmlFor="headline">Question</Label>
      <div className="mt-2 flex flex-col gap-6">
        {showImageUploader && (
          <FileInput
            id="question-image"
            allowedFileExtensions={["png", "jpeg", "jpg"]}
            environmentId={environmentId}
            onFileUpload={(url: string[]) => {
              updateQuestion(questionIdx, { imageUrl: url[0] });
            }}
            fileUrl={question.imageUrl}
          />
        )}
        <div className="flex items-center space-x-2">
          <Input
            autoFocus
            ref={ref}
            id="headline"
            name="headline"
            value={question.headline}
            onChange={(e) => updateQuestion(questionIdx, { headline: e.target.value })}
            isInvalid={isInValid && question.headline.trim() === ""}
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

export default QuestionFormInput;
