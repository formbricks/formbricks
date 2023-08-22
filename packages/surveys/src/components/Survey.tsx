import type { TResponse, TResponseData } from "@formbricks/types/v1/responses";
import type { TSurvey } from "@formbricks/types/v1/surveys";
import { useEffect, useRef, useState } from "preact/hooks";
import { evaluateCondition } from "../lib/logicEvaluator";
import { cn } from "../lib/utils";
import { AutoCloseWrapper } from "./AutoCloseWrapper";
import FormbricksSignature from "./FormbricksSignature";
import ProgressBar from "./ProgressBar";
import QuestionConditional from "./QuestionConditional";
import ThankYouCard from "./ThankYouCard";

interface SurveyProps {
  survey: TSurvey;
  brandColor: string;
  formbricksSignature: boolean;
  activeQuestionId?: string;
  onDisplay?: () => void;
  onActiveQuestionChange?: (questionId: string) => void;
  onResponse?: (response: Partial<TResponse>) => void;
  onClose?: () => void;
}

export function Survey({
  survey,
  brandColor,
  formbricksSignature,
  activeQuestionId,
  onDisplay = () => {},
  onActiveQuestionChange = () => {},
  onResponse = () => {},
  onClose = () => {},
}: SurveyProps) {
  const [questionId, setQuestionId] = useState(activeQuestionId || survey.questions[0].id);
  const [loadingElement, setLoadingElement] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [responseData, setResponseData] = useState<TResponseData>({});

  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setQuestionId(activeQuestionId || survey.questions[0].id);
  }, [activeQuestionId]);

  useEffect(() => {
    // scroll to top when question changes
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [questionId]);

  // call onDisplay when component is mounted
  useEffect(() => {
    onDisplay();
  }, []);

  function getNextQuestionId(data: TResponseData): string {
    const questions = survey.questions;
    const currentQuestionIndex = questions.findIndex((q) => q.id === questionId);
    const currentQuestion = questions[currentQuestionIndex];
    const responseValue = data[questionId];

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

  const onChange = (responseDataUpdate: TResponseData) => {
    const updatedResponseData = { ...responseData, ...responseDataUpdate };
    setResponseData(updatedResponseData);
  };

  const onSubmit = (responseData: TResponseData) => {
    setLoadingElement(true);
    const nextQuestionId = getNextQuestionId(responseData);
    onResponse({ data: responseData, finished: nextQuestionId === "end" }); // Mark as finished if next question is "end"
    setQuestionId(nextQuestionId);
    // add to history
    setHistory([...history, questionId]);
    setLoadingElement(false);
    onActiveQuestionChange(nextQuestionId);
  };

  const onBack = (): void => {
    console.log(JSON.stringify(history, null, 2));
    const newHistory = [...history];
    const prevQuestionId = newHistory.pop();
    if (!prevQuestionId) throw new Error("Question not found");
    setHistory(newHistory);
    setQuestionId(prevQuestionId);
    onActiveQuestionChange(prevQuestionId);
  };

  return (
    <>
      <AutoCloseWrapper survey={survey} brandColor={brandColor} onClose={onClose}>
        <div
          ref={contentRef}
          className={cn(
            loadingElement ? "animate-pulse opacity-60" : "",
            "flex h-full max-h-[80vh] w-full items-center justify-center overflow-y-auto px-4 py-6 font-sans text-slate-800 sm:p-6"
          )}>
          {questionId === "end" && survey.thankYouCard.enabled ? (
            <ThankYouCard
              headline={survey.thankYouCard.headline}
              subheader={survey.thankYouCard.subheader}
              brandColor={brandColor}
            />
          ) : (
            survey.questions.map(
              (question, idx) =>
                questionId === question.id && (
                  <QuestionConditional
                    question={question}
                    value={responseData[question.id]}
                    onChange={onChange}
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
        <div className="top-0 z-10 w-full border-b">
          {formbricksSignature && <FormbricksSignature />}
          <ProgressBar survey={survey} questionId={questionId} brandColor={brandColor} />
        </div>
      </AutoCloseWrapper>
    </>
  );
}
