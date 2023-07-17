import type { TJsConfig } from "../../../types/v1/js";
import type { TSurvey } from "../../../types/v1/surveys";
import type { TSurveyLogic } from "../../../types/v1/surveys";
import { h } from "preact";
import { useEffect, useRef, useState, useLayoutEffect } from "preact/hooks";
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
  const [savedAnwer, setSavedAnswer] = useState<any>(null);

  const [countdownProgress, setCountdownProgress] = useState(100);
  const [countdownStop, setCountdownStop] = useState(false);
  const startRef = useRef(performance.now());
  const frameRef = useRef<number | null>(null);

  const showBackButton = progress !== 0 && !finished;

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
    setProgress(calculateProgress());

    function calculateProgress() {
      const elementIdx = survey.questions.findIndex((e) => e.id === activeQuestionId);
      return elementIdx / survey.questions.length;
    }
  }, [activeQuestionId, survey]);

  function evaluateCondition(logic: TSurveyLogic, answerValue: any): boolean {
    switch (logic.condition) {
      case "equals":
        return (
          (Array.isArray(answerValue) && answerValue.length === 1 && answerValue.includes(logic.value)) ||
          answerValue.toString() === logic.value
        );
      case "notEquals":
        return answerValue !== logic.value;
      case "lessThan":
        return logic.value !== undefined && answerValue < logic.value;
      case "lessEqual":
        return logic.value !== undefined && answerValue <= logic.value;
      case "greaterThan":
        return logic.value !== undefined && answerValue > logic.value;
      case "greaterEqual":
        return logic.value !== undefined && answerValue >= logic.value;
      case "includesAll":
        return (
          Array.isArray(answerValue) &&
          Array.isArray(logic.value) &&
          logic.value.every((v) => answerValue.includes(v))
        );
      case "includesOne":
        return (
          Array.isArray(answerValue) &&
          Array.isArray(logic.value) &&
          logic.value.some((v) => answerValue.includes(v))
        );
      case "accepted":
        return answerValue === "accepted";
      case "clicked":
        return answerValue === "clicked";
      case "submitted":
        if (typeof answerValue === "string") {
          return answerValue !== "dismissed" && answerValue !== "" && answerValue !== null;
        } else if (Array.isArray(answerValue)) {
          return answerValue.length > 0;
        } else if (typeof answerValue === "number") {
          return answerValue !== null;
        }
        return false;
      case "skipped":
        return (
          (Array.isArray(answerValue) && answerValue.length === 0) ||
          answerValue === "" ||
          answerValue === null ||
          answerValue === "dismissed"
        );
      default:
        return false;
    }
  }

  function getNextQuestionId() {
    const questions = survey.questions;
    const currentQuestionIndex = questions.findIndex((q) => q.id === activeQuestionId);
    if (currentQuestionIndex === -1) throw new Error("Question not found");

    return questions[currentQuestionIndex + 1]?.id || "end";
  }

  function goToNextQuestion(answer: TResponseData): string {
    setLoadingElement(true);
    const questions = survey.questions;
    const nextQuestionId = getNextQuestionId();

    if (nextQuestionId === "end") {
      submitResponse(answer);
      return;
    }

    const nextQuestion = questions.find((q) => q.id === nextQuestionId);
    if (!nextQuestion) throw new Error("Question not found");

    setSavedAnswer(getStoredAnswer(survey.id, nextQuestionId));
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
      storeAnswer(survey.id, answer);
    }

    setSavedAnswer(getStoredAnswer(survey.id, previousQuestionId));
    setActiveQuestionId(previousQuestionId);
    setLoadingElement(false);
  }

  const submitResponse = async (data: TResponseData) => {
    setLoadingElement(true);
    const questions = survey.questions;
    const nextQuestionId = getNextQuestionId();
    const currentQuestion = questions[activeQuestionId];
    const answerValue = data[activeQuestionId];

    if (currentQuestion?.logic && currentQuestion?.logic.length > 0) {
      for (let logic of currentQuestion.logic) {
        if (!logic.destination) continue;

        if (evaluateCondition(logic, answerValue)) {
          return logic.destination;
        }
      }
    }

    const finished = nextQuestionId === "end";
    // build response
    const responseRequest: TResponseInput = {
      surveyId: survey.id,
      personId: config.state.person.id,
      finished,
      data,
    };
    if (!responseId) {
      const [response, _] = await Promise.all([
        createResponse(responseRequest, config),
        markDisplayResponded(displayId, config),
      ]);
      if (response.ok === true) {
        setResponseId(response.value.id);
        storeAnswer(survey.id, data);
      } else {
        errorHandler(response.error);
      }
    } else {
      const result = await updateResponse(responseRequest, responseId, config);
      storeAnswer(survey.id, data);
      if (result.ok !== true) {
        errorHandler(result.error);
      } else if (responseRequest.finished) {
        Logger.getInstance().debug("Submitted response");
      }
    }
    setLoadingElement(false);

    if (!finished && nextQuestionId !== "end") {
      setSavedAnswer(getStoredAnswer(survey.id, nextQuestionId));
      setActiveQuestionId(nextQuestionId);
    } else {
      setProgress(100);
      setFinished(true);
      clearStoredAnswers(survey.id);
      if (survey.thankYouCard.enabled) {
        setTimeout(() => {
          close();
        }, 2000);
      } else {
        close();
      }
    }
  };

  const storeAnswer = (surveyId: string, answer: TResponseData) => {
    const storedAnswers = localStorage.getItem(`formbricks-${surveyId}-answers`);
    if (storedAnswers) {
      const parsedAnswers = JSON.parse(storedAnswers);
      localStorage.setItem(`formbricks-${surveyId}-answers`, JSON.stringify({ ...parsedAnswers, ...answer }));
    } else {
      localStorage.setItem(`formbricks-${surveyId}-answers`, JSON.stringify(answer));
    }
  };

  const getStoredAnswer = (surveyId: string, questionId: string): string | null => {
    const storedAnswers = localStorage.getItem(`formbricks-${surveyId}-answers`);
    if (storedAnswers) {
      const parsedAnswers = JSON.parse(storedAnswers);
      return parsedAnswers[questionId] || null;
    }
    return null;
  };

  const clearStoredAnswers = (surveyId: string) => {
    localStorage.removeItem(`formbricks-${surveyId}-answers`);
  };

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
                  savedAnswer={savedAnwer}
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
