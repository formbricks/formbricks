import type { CTAQuestion } from "@formbricks/types/questions";
import Headline from "./Headline";
import HtmlBody from "./HtmlBody";
import { cn } from "@/../../packages/lib/cn";
import { isLight } from "@/lib/utils";
import { Button } from "@formbricks/ui";
import { Response } from "@formbricks/types/js";
import { BackButton } from "@/components/preview/BackButton";

interface CTAQuestionProps {
  question: CTAQuestion;
  onSubmit: (data: { [x: string]: any }) => void;
  lastQuestion: boolean;
  brandColor: string;
  savedAnswer: string | null;
  goToNextQuestion: (answer: Response["data"]) => void;
  goToPreviousQuestion?: (answer?: Response["data"]) => void;
}

export default function CTAQuestion({
  question,
  onSubmit,
  lastQuestion,
  brandColor,
  savedAnswer,
  goToNextQuestion,
  goToPreviousQuestion,
}: CTAQuestionProps) {
  return (
    <div>
      <Headline headline={question.headline} questionId={question.id} />
      <HtmlBody htmlString={question.html || ""} questionId={question.id} />

      <div className="mt-4 flex w-full justify-end">
        {goToPreviousQuestion && <BackButton onClick={() => goToPreviousQuestion()} />}
        <div></div>
        {(!question.required || savedAnswer) && (
          <button
            type="button"
            onClick={() => {
              if (savedAnswer) {
                goToNextQuestion({ [question.id]: "clicked" });
                return;
              }
              onSubmit({ [question.id]: "dismissed" });
            }}
            className="mr-4 flex items-center rounded-md px-3 py-3 text-base font-medium leading-4 text-slate-500 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 dark:border-slate-400 dark:text-slate-400">
            {savedAnswer === "clicked" ? "Next" : question.dismissButtonLabel || "Skip"}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (question.buttonExternal && question.buttonUrl) {
              window?.open(question.buttonUrl, "_blank")?.focus();
            }
            onSubmit({ [question.id]: "clicked" });
          }}
          className={cn(
            "flex items-center rounded-md border border-transparent px-3 py-3 text-base font-medium leading-4 shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2",
            isLight(brandColor) ? "text-black" : "text-white"
          )}
          style={{ backgroundColor: brandColor }}>
          {question.buttonLabel || (lastQuestion ? "Finish" : "Next")}
        </button>
      </div>
    </div>
  );
}
