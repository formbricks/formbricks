"use client";

import { TSurveyQuestion, TSurvey } from "@formbricks/types/surveys";
import FileInput from "@formbricks/ui/FileInput";
// import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import { ImagePlusIcon } from "lucide-react";
import { RefObject, useEffect, useState } from "react";
import { MentionsInput, Mention } from "react-mentions";

interface QuestionFormInputProps {
  question: TSurveyQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  isInValid: boolean;
  environmentId: string;
  ref?: RefObject<HTMLInputElement>;
  localSurvey: TSurvey;
}

const QuestionFormInput = ({
  question,
  localSurvey,
  questionIdx,
  updateQuestion,
  // isInValid,
  environmentId,
}: // ref,
QuestionFormInputProps) => {
  const [showImageUploader, setShowImageUploader] = useState<boolean>(!!question.imageUrl);
  const [mentionDisplayString, setMentionDisplayString] = useState<string>(question.headline);
  const [prevHeadline, setPreviousHeadline] = useState<string>("");
  const [data, setData] = useState<
    {
      id: string;
      display: string;
    }[]
  >();

  useEffect(() => {
    setData(
      localSurvey.questions.map((q) => {
        if (question.id !== q.id)
          return {
            id: q.id,
            display: q.headline,
          };
        else {
          return {
            id: "",
            display: "",
          };
        }
      })
    );
  }, [localSurvey, question]);

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
            value={mentionDisplayString}
            onChange={(event, _, newPlainTextValue) => {
              setPreviousHeadline(question.headline);
              updateQuestion(questionIdx, {
                headline: newPlainTextValue,
              });
              setMentionDisplayString(event.target.value);
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
              data={data || []}
              trigger="@"
              appendSpaceOnAdd
              markup="[__display__]"
              displayTransform={(_, display: string) => display}
              onAdd={(id: string) => {
                updateQuestion(questionIdx, {
                  recallString: prevHeadline + "recall:" + id,
                });
              }}
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
