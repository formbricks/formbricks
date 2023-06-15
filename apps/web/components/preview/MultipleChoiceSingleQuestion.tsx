import { Input } from "@/../../packages/ui";
import SubmitButton from "@/components/preview/SubmitButton";
import { cn } from "@formbricks/lib/cn";
import type { MultipleChoiceSingleQuestion } from "@formbricks/types/questions";
import { useState } from "react";
import Headline from "./Headline";
import Subheader from "./Subheader";

interface MultipleChoiceSingleProps {
  question: MultipleChoiceSingleQuestion;
  onSubmit: (data: { [x: string]: any }) => void;
  lastQuestion: boolean;
  brandColor: string;
}

export default function MultipleChoiceSingleQuestion({
  question,
  onSubmit,
  lastQuestion,
  brandColor,
}: MultipleChoiceSingleProps) {
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  /*   const [isIphone, setIsIphone] = useState(false);


  useEffect(() => {
    setIsIphone(/iPhone|iPad|iPod/.test(navigator.userAgent));
  }, []);
 */
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const value = e.currentTarget[question.id].value;
        const data = {
          [question.id]: value,
        };
        onSubmit(data);
        setSelectedChoice(null); // reset form
      }}>
      <Headline headline={question.headline} questionId={question.id} />
      <Subheader subheader={question.subheader} questionId={question.id} />
      <div className="mt-4">
        <fieldset>
          <legend className="sr-only">Options</legend>
          <div className="xs:max-h-[41vh] relative max-h-[60vh] space-y-2 overflow-y-auto rounded-md py-0.5 pr-2">
            {question.choices &&
              question.choices.map((choice, idx) => (
                <label
                  key={choice.id}
                  className={cn(
                    selectedChoice === choice.label ? "z-10 border-slate-400 bg-slate-50" : "border-gray-200",
                    "relative mb-2 flex cursor-pointer flex-col rounded-md border p-4 hover:bg-slate-50 focus:outline-none"
                  )}>
                  <span className="flex items-center text-sm">
                    <input
                      type="radio"
                      id={choice.id}
                      name={question.id}
                      value={choice.label}
                      className="h-4 w-4 border border-gray-300 focus:ring-0 focus:ring-offset-0"
                      aria-labelledby={`${choice.id}-label`}
                      onChange={() => setSelectedChoice(choice.id)}
                      checked={selectedChoice === choice.id}
                      style={{ borderColor: brandColor, color: brandColor }}
                      required={question.required && idx === 0}
                    />
                    <span id={`${choice.id}-label`} className="ml-3 font-medium">
                      {choice.label}
                    </span>
                  </span>
                  {choice.id === "other" && selectedChoice === "other" && (
                    <Input
                      id={`${choice.id}-label`}
                      name={question.id}
                      placeholder="Please specify"
                      className="mt-3 bg-white focus:border-slate-300"
                      required={question.required}
                      aria-labelledby={`${choice.id}-label`}
                      autoFocus
                    />
                  )}
                </label>
              ))}
            {/*             {isIphone && question.choices.length > 5 && (
              <div className="z-50 -mt-8 h-8 bg-gradient-to-b from-transparent to-white"></div>
            )} */}
            {/*             {isIphone && question.choices.length > 5 && (
              <div className="z-50 -mt-8 h-8 bg-gradient-to-b from-transparent to-white"></div>
            )} */}
          </div>
        </fieldset>
      </div>
      <div className="mt-4 flex w-full justify-between">
        <div></div>
        <SubmitButton {...{ question, lastQuestion, brandColor }} />
      </div>
    </form>
  );
}
