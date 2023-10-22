import { questionTypes } from "@/app/lib/questions";
import { cn } from "@formbricks/lib/cn";
import { TSurveyQuestion } from "@formbricks/types/surveys";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { FC, RefObject, useEffect, useRef, useState } from "react";
import ContentEditable from "react-contenteditable";

interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "crossOrigin" | "dangerouslySetInnerHTML"> {
  isInvalid?: boolean;
  ref?: RefObject<HTMLInputElement>;
  value?: string;
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
  const [inputValue, setInputValue] = useState<string>();
  const inputRef = useRef<any>(null);

  useEffect(() => {
    setInputValue(inputProps.value);
  }, [inputProps.value]);

  const parseInputValue = (value: typeof inputProps.value) => {
    // val --> this is nice recall:<questionID>/fallback:hello
    // this needs to parsed to --> this is nice @question-name
    if (!value) return "";
    const recallRegex = /recall:(\w+)(\/fallback:(\w+))?/;
    const match = recallRegex.exec(value);
    if (!match) return value;
    const questionId = match[1];
    const question = questionsBeforeCurrent.find((q) => q.id === questionId);
    if (!question) return value;
    const questionName = question.headline;

    const html = value.replace(
      match[0],
      `<span id=${questionId} content-editable=false class="bg-gray-100 inline px-1 rounded">${questionName}</span>`
    );

    return html;
  };

  function placeCaretAfterNode(node: HTMLElement | null) {
    if (typeof window.getSelection != "undefined" && node) {
      var range = document.createRange();
      range.setStartAfter(node);
      range.collapse(true);
      var selection = window.getSelection();
      console.log(selection);

      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }

  function moveCaret() {
    document.getElementById("EditableInput")?.focus();
    placeCaretAfterNode(document.getElementsByName("span")[0]);
  }
  // useEffect(() => {
  //   // Close the popup when the input field loses focus.
  //   const handleBlur = () => {
  //     setShowRecallDropdown(false);
  //     setShowFallbackDropdown(false);
  //   };

  //   document.addEventListener("click", handleBlur);

  //   return () => {
  //     document.removeEventListener("click", handleBlur);
  //   };
  // }, []);

  function extractContent(html: string) {
    return new DOMParser().parseFromString(html, "text/html").documentElement.textContent;
  }

  return (
    <div className="relative w-full">
      <ContentEditable
        id="EditableInput"
        onChange={(e) => {
          const { value } = e.target;

          console.log("value", value);

          const html = value.replace(
            /<span id="([^"]+)"[^>]+>([^<]+)<\/span>/,
            `recall:$1/fallback:${fallback}`
          );

          console.log("html", html);

          // then set the input value to the parsed value
          updateQuestion(questionIdx, {
            [updateProperty]: html,
          });

          if (value.includes("@")) {
            setShowRecallDropdown(true);
          } else {
            setShowRecallDropdown(false);
          }
        }}
        ref={inputRef}
        html={parseInputValue(inputValue) ?? ""}
        className={cn(
          "focus:border-brand flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none  focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-500 dark:text-slate-300",
          inputProps.isInvalid && "border border-red-600 focus:border-red-600"
        )}
      />
      {/* <Input
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
      /> */}
      {showRecallDropdown && (
        <div className="scrollbar-hide absolute z-10 mt-0 h-48 w-1/2 rounded-md border bg-white shadow-lg">
          <div className="scrollbar-hide h-full overflow-y-auto">
            <p className="p-2 text-sm font-normal">Recall Information from...</p>
            <ul>
              {questionsBeforeCurrent.length > 0 ? (
                questionsBeforeCurrent.map((q) => {
                  const QuestionTypeIcon = questionTypes.find((qType) => qType.id === q.type)?.icon || null;
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
                        setFallback("");
                      }}>
                      <div className="flex items-center gap-3">
                        {QuestionTypeIcon && (
                          <QuestionTypeIcon
                            className="-ml-0.5 mr-2 h-5 w-5 text-zinc-800"
                            aria-hidden="true"
                          />
                        )}
                        <p className="max-w-[90%]">{q.headline}</p>
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

                // document.getElementById("EditableInput")?.focus();
                // placeCaretAfterNode(document.getElementById(recallQuestionId));

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
