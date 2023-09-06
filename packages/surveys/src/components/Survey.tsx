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
import { checkValidity, handlePrefilling } from "../lib/prefilling";

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
  const currentQuestionIndex = survey.questions.findIndex((q) => q.id === questionId);
  const currentQuestion = survey.questions[currentQuestionIndex];
  const URLParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const firstQuestionPrefill = URLParams.has(survey.questions[0].id)
    ? URLParams.get(survey.questions[0].id)
    : null;
  const isPrefilledAnswerValid = firstQuestionPrefill
    ? checkValidity(survey.questions[0], firstQuestionPrefill)
    : false;
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setQuestionId(activeQuestionId || survey.questions[0].id);
  }, [activeQuestionId]);

  useEffect(() => {
    if (firstQuestionPrefill && isPrefilledAnswerValid) {
      handlePrefilling(currentQuestion, survey, firstQuestionPrefill, onSubmit);
    }
  }, [handlePrefilling]);

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
    if (isPrefilledAnswerValid && firstQuestionPrefill && prevQuestionId === survey.questions[0].id) return;
    if (!prevQuestionId) throw new Error("Question not found");
    setHistory(newHistory);
    setQuestionId(prevQuestionId);
    onActiveQuestionChange(prevQuestionId);
  };

  return (
    <>
      <AutoCloseWrapper survey={survey} brandColor={brandColor} onClose={onClose}>
        <div className="flex h-full w-full flex-col justify-between bg-white px-6 pb-3 pt-5">
          <div ref={contentRef} className={cn(loadingElement ? "animate-pulse opacity-60" : "", "my-auto")}>
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
          <div className="mt-8">
            {formbricksSignature && <FormbricksSignature />}
            <ProgressBar survey={survey} questionId={questionId} brandColor={brandColor} />
          </div>
        </div>
      </AutoCloseWrapper>
    </>
  );
}
