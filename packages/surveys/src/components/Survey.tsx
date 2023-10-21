import type { TResponseData } from "@formbricks/types/v1/responses";
import { useEffect, useRef, useState } from "preact/hooks";
import { evaluateCondition } from "../lib/logicEvaluator";
import { cn } from "../lib/utils";
import { SurveyBaseProps } from "../types/props";
import { AutoCloseWrapper } from "./AutoCloseWrapper";
import FormbricksSignature from "./FormbricksSignature";
import ProgressBar from "./ProgressBar";
import QuestionConditional from "./QuestionConditional";
import ThankYouCard from "./ThankYouCard";
import WelcomeCard from "./WelcomeCard";

export function Survey({
  survey,
  brandColor,
  formbricksSignature,
  activeQuestionId,
  onDisplay = () => {},
  onActiveQuestionChange = () => {},
  onResponse = () => {},
  onClose = () => {},
  onFinished = () => {},
  isRedirectDisabled = false,
  prefillResponseData,
}: SurveyBaseProps) {
  const [questionId, setQuestionId] = useState(
    activeQuestionId || (survey.welcomeCard.enabled ? "start" : survey?.questions[0]?.id)
  );
  const [loadingElement, setLoadingElement] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [responseData, setResponseData] = useState<TResponseData>({});
  const currentQuestionIndex = survey.questions.findIndex((q) => q.id === questionId);
  const currentQuestion = survey.questions[currentQuestionIndex];
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setQuestionId(activeQuestionId || (survey.welcomeCard.enabled ? "start" : survey?.questions[0]?.id));
  }, [activeQuestionId, survey.questions]);

  useEffect(() => {
    // scroll to top when question changes
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [questionId]);

  // call onDisplay when component is mounted
  useEffect(() => {
    onDisplay();
    if (prefillResponseData) {
      onSubmit(prefillResponseData);
    }
  }, []);
  function getNextQuestionId(data: TResponseData): string {
    const questions = survey.questions;
    const responseValue = data[questionId];

    if (questionId === "start") {
      return questions[0]?.id || "end";
    }

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

  const onSubmit = (responseData: TResponseData, isSubmit: boolean, time?: any) => {
    console.log(time);
    const questionId = Object.keys(responseData)[0];
    const timeData = { [questionId]: time };
    Object.keys(responseData)[0];
    if (!isSubmit) {
      onResponse({ data: responseData, ttc: timeData, finished: false });
      return;
    }
    setLoadingElement(true);
    const nextQuestionId = getNextQuestionId(responseData);
    const finished = nextQuestionId === "end";
    onResponse({ data: responseData, ttc: timeData, finished });
    if (finished) {
      onFinished();
    }
    setQuestionId(nextQuestionId);
    // add to history
    setHistory([...history, questionId]);
    setLoadingElement(false);
    onActiveQuestionChange(nextQuestionId);
  };

  const onBack = (): void => {
    let prevQuestionId;
    // use history if available
    if (history?.length > 0) {
      const newHistory = [...history];
      prevQuestionId = newHistory.pop();
      if (prefillResponseData && prevQuestionId === survey.questions[0].id) return;
      setHistory(newHistory);
    } else {
      // otherwise go back to previous question in array
      prevQuestionId = survey.questions[currentQuestionIndex - 1]?.id;
    }
    if (!prevQuestionId) throw new Error("Question not found");
    setQuestionId(prevQuestionId);
    onActiveQuestionChange(prevQuestionId);
  };

  return (
    <>
      <AutoCloseWrapper survey={survey} brandColor={brandColor} onClose={onClose}>
        <div className="flex h-full w-full flex-col justify-between bg-white px-6 pb-3 pt-6">
          <div ref={contentRef} className={cn(loadingElement ? "animate-pulse opacity-60" : "", "my-auto")}>
            {questionId === "start" && survey.welcomeCard.enabled ? (
              <WelcomeCard
                headline={survey.welcomeCard.headline}
                html={survey.welcomeCard.html}
                fileUrl={survey.welcomeCard.fileUrl}
                buttonLabel={survey.welcomeCard.buttonLabel}
                timeToFinish={survey.welcomeCard.timeToFinish}
                brandColor={brandColor}
                onSubmit={onSubmit}
              />
            ) : questionId === "end" && survey.thankYouCard.enabled ? (
              <ThankYouCard
                headline={survey.thankYouCard.headline}
                subheader={survey.thankYouCard.subheader}
                brandColor={brandColor}
                redirectUrl={survey.redirectUrl}
                isRedirectDisabled={isRedirectDisabled}
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
                      isFirstQuestion={
                        // if prefillResponseData is provided, check if we're on the first "real" question
                        history && prefillResponseData
                          ? history[history.length - 1] === survey.questions[0].id
                          : idx === 0
                      }
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
