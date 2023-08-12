import type { TJsConfig } from "../../../types/v1/js";
import type { TSurvey } from "../../../types/v1/surveys";
import type { TSurveyLogic } from "../../../types/v1/surveys";
import { h } from "preact";
import { useEffect, useRef, useState, useLayoutEffect, useCallback } from "preact/hooks";
import { createDisplay, markDisplayResponded } from "../lib/display";
import { IErrorHandler } from "../lib/errors";
import { Logger } from "../lib/logger";
import { createResponse, updateResponse } from "../lib/response";
import { cn } from "../lib/utils";
import Progress from "./Progress";
import QuestionConditional from "./QuestionConditional";
import ThankYouCard from "./ThankYouCard";
import FormbricksSignature from "./FormbricksSignature";
import type { TResponseData, TResponseInput } from "../../../types/v1/responses";
import { clearStoredResponse, getStoredResponse, storeResponse } from "../lib/localStorage";

interface SurveyViewProps {
  config: TJsConfig;
  survey: TSurvey;
  close: () => void;
  errorHandler: IErrorHandler;
}

export default function SurveyView({ config, survey, close, errorHandler }: SurveyViewProps) {
  const [activeQuestionId, setActiveQuestionId] = useState(survey.questions[0].id);
  const [progress, setProgress] = useState(0); // [0, 1]
  const [responseId, setResponseId] = useState<string | null>(null);
  const [displayId, setDisplayId] = useState<string | null>(null);
  const [loadingElement, setLoadingElement] = useState(false);
  const contentRef = useRef(null);
  const [finished, setFinished] = useState(false);
  const [storedResponseValue, setStoredResponseValue] = useState<any>(null);

  const [countdownProgress, setCountdownProgress] = useState(100);
  const [countdownStop, setCountdownStop] = useState(false);
  const startRef = useRef(performance.now());
  const frameRef = useRef<number | null>(null);

  const showBackButton =
    survey.questions.findIndex((question) => question.id === activeQuestionId) !== 0 && !finished;

  const handleStopCountdown = () => {
    if (frameRef.current !== null) {
      setCountdownStop(true);
      cancelAnimationFrame(frameRef.current);
    }
  };

  //Scroll to top when question changes
  useLayoutEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [activeQuestionId]);

  useEffect(() => {
    if (!survey.autoClose) return;
    const frame = () => {
      if (!survey.autoClose || !startRef.current) return;

      const timeout = survey.autoClose * 1000;
      const elapsed = performance.now() - startRef.current;
      const remaining = Math.max(0, timeout - elapsed);

      setCountdownProgress(remaining / timeout);

      if (remaining > 0) {
        frameRef.current = requestAnimationFrame(frame);
      } else {
        handleStopCountdown();
        close();
      }
    };

    setCountdownStop(false);
    setCountdownProgress(1);
    frameRef.current = requestAnimationFrame(frame);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [survey.autoClose, close]);

  useEffect(() => {
    initDisplay();
    async function initDisplay() {
      const createDisplayResult = await createDisplay(
        { surveyId: survey.id, personId: config.state.person.id },
        config
      );

      createDisplayResult.ok === true
        ? setDisplayId(createDisplayResult.value.id)
        : errorHandler(createDisplayResult.error);
    }
  }, [config, survey, errorHandler]);

  useEffect(() => {
    setProgress(calculateProgress(activeQuestionId, survey, progress));
  }, [activeQuestionId, survey]);

  function evaluateCondition(logic: TSurveyLogic, responseValue: any): boolean {
    switch (logic.condition) {
      case "equals":
        return (
          (Array.isArray(responseValue) &&
            responseValue.length === 1 &&
            responseValue.includes(logic.value)) ||
          responseValue.toString() === logic.value
        );
      case "notEquals":
        return responseValue !== logic.value;
      case "lessThan":
        return logic.value !== undefined && responseValue < logic.value;
      case "lessEqual":
        return logic.value !== undefined && responseValue <= logic.value;
      case "greaterThan":
        return logic.value !== undefined && responseValue > logic.value;
      case "greaterEqual":
        return logic.value !== undefined && responseValue >= logic.value;
      case "includesAll":
        return (
          Array.isArray(responseValue) &&
          Array.isArray(logic.value) &&
          logic.value.every((v) => responseValue.includes(v))
        );
      case "includesOne":
        return (
          Array.isArray(responseValue) &&
          Array.isArray(logic.value) &&
          logic.value.some((v) => responseValue.includes(v))
        );
      case "accepted":
        return responseValue === "accepted";
      case "clicked":
        return responseValue === "clicked";
      case "submitted":
        if (typeof responseValue === "string") {
          return responseValue !== "dismissed" && responseValue !== "" && responseValue !== null;
        } else if (Array.isArray(responseValue)) {
          return responseValue.length > 0;
        } else if (typeof responseValue === "number") {
          return responseValue !== null;
        }
        return false;
      case "skipped":
        return (
          (Array.isArray(responseValue) && responseValue.length === 0) ||
          responseValue === "" ||
          responseValue === null ||
          responseValue === "dismissed"
        );
      default:
        return false;
    }
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

  function goToNextQuestion(answer: TResponseData): string {
    setLoadingElement(true);
    const questions = survey.questions;
    const nextQuestionId = getNextQuestionId(answer);

    if (nextQuestionId === "end") {
      submitResponse(answer);
      return;
    }

    const nextQuestion = questions.find((q) => q.id === nextQuestionId);
    if (!nextQuestion) throw new Error("Question not found");

    setStoredResponseValue(getStoredResponse(survey.id, nextQuestionId));
    setActiveQuestionId(nextQuestionId);
    setLoadingElement(false);
  }

  function getPreviousQuestionId() {
    const questions = survey.questions;
    const currentQuestionIndex = questions.findIndex((q) => q.id === activeQuestionId);
    if (currentQuestionIndex === -1) throw new Error("Question not found");

    return questions[currentQuestionIndex - 1]?.id;
  }

  function goToPreviousQuestion(answer: TResponseData) {
    setLoadingElement(true);
    const previousQuestionId = getPreviousQuestionId();
    if (!previousQuestionId) throw new Error("Question not found");

    if (answer) {
      storeResponse(survey.id, answer);
    }

    setStoredResponseValue(getStoredResponse(survey.id, previousQuestionId));
    setActiveQuestionId(previousQuestionId);
    setLoadingElement(false);
  }

  const submitResponse = async (data: TResponseData) => {
    setLoadingElement(true);
    const nextQuestionId = getNextQuestionId(data);
    const finished = nextQuestionId === "end";
    // build response
    const responseRequest: TResponseInput = {
      surveyId: survey.id,
      personId: config.state.person.id,
      finished,
      data,
      meta: {
        url: window.location.href,
      },
    };
    if (!responseId) {
      const [response, _] = await Promise.all([
        createResponse(responseRequest, config),
        markDisplayResponded(displayId, config),
      ]);
      if (response.ok === true) {
        setResponseId(response.value.id);
        storeResponse(survey.id, data);
      } else {
        errorHandler(response.error);
      }
    } else {
      const result = await updateResponse(responseRequest, responseId, config);
      storeResponse(survey.id, data);
      if (result.ok !== true) {
        errorHandler(result.error);
      } else if (responseRequest.finished) {
        Logger.getInstance().debug("Submitted response");
      }
    }
    setLoadingElement(false);

    if (!finished && nextQuestionId !== "end") {
      setStoredResponseValue(getStoredResponse(survey.id, nextQuestionId));
      setActiveQuestionId(nextQuestionId);
    } else {
      setProgress(100);
      setFinished(true);
      clearStoredResponse(survey.id);
      if (survey.thankYouCard.enabled) {
        setTimeout(() => {
          close();
        }, 2000);
      } else {
        close();
      }
    }
  };
  let questionIdxTemp;
  const progressArray: number[] = new Array(survey.questions.length).fill(undefined);
  const calculateProgress = useCallback(
    (currentQuestionId: string, survey: TSurvey, currentProgress: number) => {
      const currentQuestionIdx = survey.questions.findIndex((e) => e.id === currentQuestionId);
      const currentQuestion = survey.questions[currentQuestionIdx];
      const surveyLength = survey.questions.length;
      const middleIdx = Math.floor(surveyLength / 2);

      // if idx would be zero, return 0.5 to achieve the goal gradient effect
      let elementIdx = currentQuestionIdx || 0.5;

      // get all possible next questions ids from logic
      const possibleNextQuestions = currentQuestion.logic?.map((l) => l.destination) || [];

      const lastQuestion = survey.questions
        .filter((q) => possibleNextQuestions.includes(q.id))
        .sort((a, b) => survey.questions.indexOf(a) - survey.questions.indexOf(b))
        .pop();
      const lastQuestionIdx = survey.questions.findIndex((e) => e.id === lastQuestion?.id);

      // set elementIdx to whichever is smaller, the middleIdx or the questionIdx
      if (lastQuestionIdx > 0) elementIdx = Math.min(middleIdx, lastQuestionIdx - 1);
      if (possibleNextQuestions.includes("end")) elementIdx = middleIdx;

      const newProgress = elementIdx / survey.questions.length;

      // logic to check whether user has clicked on back button
      if (currentQuestionIdx < questionIdxTemp) {
        // progressArray is an array to store progress values of question where index of progressArray is equivalent to questionIdx
        if (progressArray[currentQuestionIdx]) {
          return progressArray[currentQuestionIdx];
        }
        // it may happen that due to logic jumps progress of some quesions can be missing
        progressArray[currentQuestionIdx] = currentProgress - 0.1;
        questionIdxTemp = currentQuestionIdx;
        return currentProgress - 0.1;
      }
      questionIdxTemp = currentQuestionIdx;

      // Move forward by 5% or keep the new progress if it's greater
      if (newProgress > currentProgress) {
        progressArray[currentQuestionIdx] = newProgress;
        return newProgress;
      } else if (newProgress <= currentProgress && currentProgress + 0.1 <= 1) {
        // Make sure not to exceed 100%
        progressArray[currentQuestionIdx] = currentProgress + 0.1;
        return currentProgress + 0.1;
      }

      progressArray[currentQuestionIdx] = currentProgress;
      return currentProgress; // In case no condition is met, return the current progress
    },
    []
  );

  return (
    <div>
      {!countdownStop && survey.autoClose && (
        <Progress progress={countdownProgress} brandColor={config.state?.product?.brandColor} />
      )}
      <div
        ref={contentRef}
        className={cn(
          loadingElement ? "fb-animate-pulse fb-opacity-60" : "",
          "fb-text-slate-800 fb-font-sans fb-px-4 fb-py-6 sm:fb-p-6 fb-max-h-[80vh] fb-overflow-y-auto"
        )}
        onClick={() => handleStopCountdown()}
        onMouseOver={() => handleStopCountdown()}>
        {progress === 100 && survey.thankYouCard.enabled ? (
          <ThankYouCard
            headline={survey.thankYouCard.headline}
            subheader={survey.thankYouCard.subheader}
            brandColor={config.state.product?.brandColor}
          />
        ) : (
          survey.questions.map(
            (question, idx) =>
              activeQuestionId === question.id && (
                <QuestionConditional
                  key={question.id}
                  brandColor={config.state?.product?.brandColor}
                  lastQuestion={idx === survey.questions.length - 1}
                  onSubmit={submitResponse}
                  question={question}
                  storedResponseValue={storedResponseValue}
                  goToNextQuestion={goToNextQuestion}
                  goToPreviousQuestion={showBackButton ? goToPreviousQuestion : undefined}
                />
              )
          )
        )}
      </div>
      {config.state?.product?.formbricksSignature && <FormbricksSignature />}
      <Progress progress={progress} brandColor={config.state?.product.brandColor} />
    </div>
  );
}
