import type { TResponseData } from "@formbricks/types/responses";
import { useEffect, useRef, useState } from "preact/hooks";
import { evaluateCondition } from "../../lib/logicEvaluator";
import { cn } from "../../lib/utils";
import { SurveyBaseProps } from "../../types/props";
import { AutoCloseWrapper } from "../wrappers/AutoCloseWrapper";
import FormbricksSignature from "./FormbricksSignature";
import ProgressBar from "./ProgressBar";
import QuestionConditional from "./QuestionConditional";
import ThankYouCard from "./ThankYouCard";
import WelcomeCard from "./WelcomeCard";

export function Survey({
  survey,
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
    if (activeQuestionId === "start" && !survey.welcomeCard.enabled) {
      setQuestionId(survey?.questions[0]?.id);
      return;
    }
    setQuestionId(activeQuestionId || (survey.welcomeCard.enabled ? "start" : survey?.questions[0]?.id));
  }, [activeQuestionId, survey.questions, survey.welcomeCard.enabled]);

  useEffect(() => {
    // scroll to top when question changes
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [questionId]);

  useEffect(() => {
    // call onDisplay when component is mounted
    onDisplay();
    if (prefillResponseData) {
      onSubmit(prefillResponseData, true);
    }
  }, []);
  let currIdx = currentQuestionIndex;
  let currQues = currentQuestion;
  function getNextQuestionId(data: TResponseData, isFromPrefilling: Boolean = false): string {
    const questions = survey.questions;
    const responseValue = data[questionId];

    if (questionId === "start") {
      if (!isFromPrefilling) {
        return questions[0]?.id || "end";
      } else {
        currIdx = 0;
        currQues = questions[0];
      }
    }
    if (currIdx === -1) throw new Error("Question not found");

    if (currQues?.logic && currQues?.logic.length > 0) {
      for (let logic of currQues.logic) {
        if (!logic.destination) continue;

        if (evaluateCondition(logic, responseValue)) {
          return logic.destination;
        }
      }
    }
    return questions[currIdx + 1]?.id || "end";
  }

  const onChange = (responseDataUpdate: TResponseData) => {
    const updatedResponseData = { ...responseData, ...responseDataUpdate };
    setResponseData(updatedResponseData);
  };

  const onSubmit = (responseData: TResponseData, isFromPrefilling: Boolean = false) => {
    setLoadingElement(true);
    const nextQuestionId = getNextQuestionId(responseData, isFromPrefilling);
    const finished = nextQuestionId === "end";
    onResponse({ data: responseData, finished });
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
      prevQuestionId = survey.questions[currIdx - 1]?.id;
    }
    if (!prevQuestionId) throw new Error("Question not found");
    setQuestionId(prevQuestionId);
    onActiveQuestionChange(prevQuestionId);
  };
  function getCardContent() {
    if (questionId === "start" && survey.welcomeCard.enabled) {
      return (
        <WelcomeCard
          headline={survey.welcomeCard.headline}
          html={survey.welcomeCard.html}
          fileUrl={survey.welcomeCard.fileUrl}
          buttonLabel={survey.welcomeCard.buttonLabel}
          timeToFinish={survey.welcomeCard.timeToFinish}
          onSubmit={onSubmit}
        />
      );
    } else if (questionId === "end" && survey.thankYouCard.enabled) {
      return (
        <ThankYouCard
          headline={survey.thankYouCard.headline}
          subheader={survey.thankYouCard.subheader}
          redirectUrl={survey.redirectUrl}
          isRedirectDisabled={isRedirectDisabled}
        />
      );
    } else {
      const currQues = survey.questions.find((q) => q.id === questionId);
      return (
        currQues && (
          <QuestionConditional
            question={currQues}
            value={responseData[currQues.id]}
            onChange={onChange}
            onSubmit={onSubmit}
            onBack={onBack}
            isFirstQuestion={
              history && prefillResponseData
                ? history[history.length - 1] === survey.questions[0].id
                : currQues.id === survey?.questions[0]?.id
            }
            isLastQuestion={currQues.id === survey.questions[survey.questions.length - 1].id}
          />
        )
      );
    }
  }

  return (
    <>
      <AutoCloseWrapper survey={survey} onClose={onClose}>
        <div className="formbricks-inner">
          <div ref={contentRef} className={cn(loadingElement ? "animate-pulse opacity-60" : "", "my-auto")}>
            {survey.questions.length === 0 && !survey.welcomeCard.enabled && !survey.thankYouCard.enabled ? (
              // Handle the case when there are no questions and both welcome and thank you cards are disabled
              <div>No questions available.</div>
            ) : (
              getCardContent()
            )}
          </div>
          <div className="formbricks-footer">
            {formbricksSignature && <FormbricksSignature />}
            <ProgressBar survey={survey} questionId={questionId} />
          </div>
        </div>
      </AutoCloseWrapper>
    </>
  );
}
