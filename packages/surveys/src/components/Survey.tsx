import type { TResponse, TResponseData } from "@formbricks/types/v1/responses";
import type { TSurvey } from "@formbricks/types/v1/surveys";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { evaluateCondition } from "../lib/logicEvaluator";
import { cn } from "../lib/utils";
import { AutoCloseWrapper } from "./AutoCloseWrapper";
import FormbricksSignature from "./FormbricksSignature";
import Progress from "./Progress";
import QuestionConditional from "./QuestionConditional";
import ThankYouCard from "./ThankYouCard";

interface SurveyViewProps {
  survey: TSurvey;
  brandColor: string;
  formbricksSignature: boolean;
  onDisplay?: () => void;
  onResponse?: (response: Partial<TResponse>) => void;
  onClose?: () => void;
}

export function Survey({
  survey,
  brandColor,
  formbricksSignature,
  onDisplay = () => {},
  onResponse = () => {},
  onClose = () => {},
}: SurveyViewProps) {
  const [activeQuestionId, setActiveQuestionId] = useState(survey.questions[0].id);
  const [progress, setProgress] = useState(0); // [0, 1]
  const [loadingElement, setLoadingElement] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  const contentRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    // scroll to top when question changes
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [activeQuestionId]);

  // call onDisplay when component is mounted
  useEffect(() => {
    onDisplay();
  }, []);

  useEffect(() => {
    // calculate progress
    setProgress(calculateProgress());

    function calculateProgress() {
      if (activeQuestionId === "end") return 100;
      const elementIdx = survey.questions.findIndex((e) => e.id === activeQuestionId);
      return elementIdx / survey.questions.length;
    }
  }, [activeQuestionId, survey]);

  useEffect(() => {
    // store history stack
    setHistory([...history, activeQuestionId]);
  }, [activeQuestionId]);

  function onSubmit(responseData: TResponseData) {
    setLoadingElement(true);
    const nextQuestionId = getNextQuestionId(responseData);
    onResponse({ data: responseData, finished: nextQuestionId === "end" }); // Mark as finished if next question is "end"
    setActiveQuestionId(nextQuestionId);
    setLoadingElement(false);
  }

  function getNextQuestionId(data: TResponseData): string {
    const questions = survey.questions;
    const currentQuestionIndex = questions.findIndex((q) => q.id === activeQuestionId);
    const currentQuestion = questions[currentQuestionIndex];
    const responseValue = data[activeQuestionId];

    if (currentQuestionIndex === -1) throw new Error("Question not found");

    if (currentQuestion?.logic && currentQuestion?.logic.length > 0) {
      for (let logic of currentQuestion.logic) {
        if (!logic.destination) continue;

        if (evaluateCondition(logic, responseValue)) {
          return logic.destination;
        }
      }
    }
    return questions[currentQuestionIndex + 1]?.id || "end";
  }

  const onBack = (): void => {
    const newHistory = [...history];
    const prevQuestionId = newHistory.pop();
    if (!prevQuestionId) throw new Error("Question not found");
    setHistory(newHistory);
    setActiveQuestionId(prevQuestionId);
  };

  return (
    <div id="fbjs">
      <AutoCloseWrapper survey={survey} brandColor={brandColor} onClose={onClose}>
        <div
          ref={contentRef}
          className={cn(
            loadingElement ? "animate-pulse opacity-60" : "",
            "max-h-[80vh] overflow-y-auto px-4 py-6 font-sans text-slate-800 sm:p-6"
          )}>
          {activeQuestionId === "end" && survey.thankYouCard.enabled ? (
            <ThankYouCard
              headline={survey.thankYouCard.headline}
              subheader={survey.thankYouCard.subheader}
              brandColor={brandColor}
            />
          ) : (
            survey.questions.map(
              (question, idx) =>
                activeQuestionId === question.id && (
                  <QuestionConditional
                    question={question}
                    onSubmit={onSubmit}
                    onBack={onBack}
                    isFirstQuestion={idx === 0}
                    isLastQuestion={idx === survey.questions.length - 1}
                    brandColor={brandColor}
                  />
                )
            )
          )}
        </div>
        {formbricksSignature && <FormbricksSignature />}
        <Progress progress={progress} brandColor={brandColor} />
      </AutoCloseWrapper>
    </div>
  );
}
