import { TSurveyQuestion } from "@formbricks/types/surveys";
import { Input } from "@formbricks/ui/Input";
import { Button } from "@formbricks/ui/Button";
import { ChatBubbleBottomCenterTextIcon } from "@heroicons/react/24/solid";
import { FC, RefObject, useState } from "react";

interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "crossOrigin" | "dangerouslySetInnerHTML"> {
  isInvalid?: boolean;
  ref?: RefObject<HTMLInputElement>;
}

interface QuestionFormInputProps {
  questionsBeforeCurrent: TSurveyQuestion[];
  onInputChange: (value: string) => void;
  inputProps: InputProps;
  question: TSurveyQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  updateProperty: "headline" | "subheader";
}

export const QuestionFormInput: FC<QuestionFormInputProps> = ({
  question,
  questionIdx,
  updateQuestion,
  questionsBeforeCurrent,
  onInputChange,
  inputProps,
  updateProperty,
}) => {
  const [showRecallDropdown, setShowRecallDropdown] = useState(false);
  const [showFallbackDropdown, setShowFallbackDropdown] = useState(false);
  const [fallback, setFallback] = useState("");
  const [recallQuestionId, setRecallQuestionId] = useState<string | null>(null);

  return (
    <div className="relative w-full">
      <Input
        onChange={(e) => {
          const { value } = e.target;
          onInputChange(value);
          if (value.includes("@")) {
            setShowRecallDropdown(true);
          } else {
            setShowRecallDropdown(false);
          }
        }}
        {...inputProps}
      />
      {showRecallDropdown && (
        <div className="absolute z-10 mt-0 w-1/2 rounded-md border bg-white shadow-lg">
          <p className="p-2 text-sm font-normal">Recall Information from...</p>
          <ul>
            {questionsBeforeCurrent.length > 0 ? (
              questionsBeforeCurrent.map((q) => {
                return (
                  <li
                    key={q.id}
                    className="cursor-pointer px-4 py-2 hover:bg-gray-100"
                    onClick={() => {
                      // store the recall id in state
                      setRecallQuestionId(q.id);
                      // close the dropdown
                      setShowRecallDropdown(false);
                      // trigger opening of another dropdown which will be designed to show the fallback
                      setShowFallbackDropdown(true);
                    }}>
                    <div className="flex items-center gap-3">
                      <ChatBubbleBottomCenterTextIcon
                        className="-ml-0.5 mr-2 h-5 w-5 text-zinc-800"
                        aria-hidden="true"
                      />
                      <p>{q.headline}</p>
                    </div>
                  </li>
                );
              })
            ) : (
              <li
                className="cursor-pointer p-2 hover:bg-gray-100"
                onClick={() => setShowRecallDropdown(false)}>
                no questions to refer
              </li>
            )}
          </ul>
        </div>
      )}
      {showFallbackDropdown && (
        <div className="absolute z-10 mt-0 w-1/2 rounded border bg-white shadow-lg">
          <p className="p-2 text-sm font-normal">Add a fallback if data is missing</p>
          <div className="flex items-center justify-between gap-3 p-2">
            <Input value={fallback} onChange={(e) => setFallback(e.target.value)} />
            <Button
              variant="darkCTA"
              onClick={() => {
                // replace the @ with recall:questionId/fallback:fallback with regex
                if (!fallback || !recallQuestionId) return;
                updateQuestion(questionIdx, {
                  [updateProperty]: question[updateProperty]?.replace(
                    "@",
                    `recall:${recallQuestionId}/fallback:${fallback}`
                  ),
                });
                // reset the fallback
                setFallback("");
                // close the dropdown
                setShowFallbackDropdown(false);
              }}>
              Submit
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
