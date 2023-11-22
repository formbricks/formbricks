"use client";

import { TSurveyQuestion } from "@formbricks/types/surveys";
import FileInput from "@formbricks/ui/FileInput";
// import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import { ImagePlusIcon } from "lucide-react";
import { RefObject, useState } from "react";
import { MentionsInput, Mention } from "react-mentions";

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

  const data = [
    { id: "question 1", display: "question 1" },
    { id: "question 2", display: "question 2" },
    { id: "question 3", display: "question 3" },
    { id: "question 4", display: "question 4" },
    { id: "question 5", display: "question 5" },
  ];

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
          {/* <Input
            autoFocus
            ref={ref}
            id="headline"
            name="headline"
            value={question.headline}
            onChange={(e) => updateQuestion(questionIdx, { headline: e.target.value })}
            isInvalid={isInValid && question.headline.trim() === ""}
          /> */}
          <MentionsInput
            autoFocus
            // ref={ref}
            id="headline"
            name="headline"
            value={question.headline}
            onChange={(event) => {
              updateQuestion(questionIdx, {
                headline: event.target.value,
              });
            }}
            style={{
              width: "100%",
              border: "1px rgb(203 213 225) solid",
              borderRadius: "4px",
              textArea: {
                border: "none",
                marginBottom: "1rem",
              },
              suggestions: {
                list: {
                  backgroundColor: "white",
                  fontSize: 14,
                },
                item: {
                  padding: "5px 15px",
                  "&focused": {
                    backgroundColor: "#cee4e5",
                  },
                },
              },
            }}>
            <Mention
              data={data}
              trigger="@"
              appendSpaceOnAdd
              markup="[__display__]"
              displayTransform={(_, display: string) => display}
              style={{
                backgroundColor: "#cee4e5",
                padding: "0.2rem",
                marginLeft: "0.5rem",
              }}
            />
          </MentionsInput>
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
