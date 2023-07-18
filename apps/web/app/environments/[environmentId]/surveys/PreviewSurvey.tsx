"use client";

import FormbricksSignature from "@/components/preview/FormbricksSignature";
import Modal from "@/components/preview/Modal";
import Progress from "@/components/preview/Progress";
import QuestionConditional from "@/components/preview/QuestionConditional";
import TabOption from "@/components/preview/TabOption";
import ThankYouCard from "@/components/preview/ThankYouCard";
import type { Logic, Question } from "@formbricks/types/questions";
import { Survey } from "@formbricks/types/surveys";
import { useEffect, useRef, useState } from "react";
import type { TProduct } from "@formbricks/types/v1/product";
import type { TEnvironment } from "@formbricks/types/v1/environment";
import { DevicePhoneMobileIcon, ComputerDesktopIcon } from "@heroicons/react/24/solid";
interface PreviewSurveyProps {
  setActiveQuestionId: (id: string | null) => void;
  activeQuestionId?: string | null;
  questions: Question[];
  brandColor: string;
  environmentId: string;
  surveyType: Survey["type"];
  thankYouCard: Survey["thankYouCard"];
  autoClose: Survey["autoClose"];
  previewType?: "modal" | "fullwidth" | "email";
  product: TProduct;
  environment: TEnvironment;
}

// Extracted modal content to prevent duplication
const PreviewModalContent = ({
  handleStopCountdown,
  activeQuestionId,
  lastActiveQuestionId,
  thankYouCard,
  questions,
  brandColor,
  gotoNextQuestion,
  showFormbricksSignature,
  progress,
}) => (
  <div>
    <div
      onClick={() => handleStopCountdown()}
      onMouseOver={() => handleStopCountdown()}
      className="px-4 py-6 sm:p-6">
      <QuestionRenderer
        activeQuestionId={activeQuestionId}
        lastActiveQuestionId={lastActiveQuestionId}
        questions={questions}
        brandColor={brandColor}
        thankYouCard={thankYouCard}
        gotoNextQuestion={gotoNextQuestion}
      />
      {showFormbricksSignature && <FormbricksSignature />}
    </div>
    <Progress progress={progress} brandColor={brandColor} />
  </div>
);

const QuestionRenderer = ({ activeQuestionId, lastActiveQuestionId, questions, brandColor, thankYouCard, gotoNextQuestion }) => {
  if ((activeQuestionId || lastActiveQuestionId) === "thank-you-card") {
    return (
      <ThankYouCard
        brandColor={brandColor}
        headline={thankYouCard?.headline || "Thank you!"}
        subheader={thankYouCard?.subheader || "We appreciate your feedback."}
      />
    );
  }

  return (
    <>
      {questions.map((question, idx) => {
        if ((activeQuestionId || lastActiveQuestionId) === question.id) {
          return (
            <QuestionConditional
              key={question.id}
              question={question}
              brandColor={brandColor}
              lastQuestion={idx === questions.length - 1}
              onSubmit={gotoNextQuestion}
            />
          );
        }
        return null;
      })}
    </>
  );
};

export default function PreviewSurvey({
  setActiveQuestionId,
  activeQuestionId,
  questions,
  brandColor,
  surveyType,
  thankYouCard,
  autoClose,
  previewType,
  product,
  environment,
}: PreviewSurveyProps) {
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [progress, setProgress] = useState(0); // [0, 1]
  const [widgetSetupCompleted, setWidgetSetupCompleted] = useState(false);
  const [lastActiveQuestionId, setLastActiveQuestionId] = useState("");
  const [showFormbricksSignature, setShowFormbricksSignature] = useState(false);
  const [countdownProgress, setCountdownProgress] = useState(1);
  const startRef = useRef(performance.now());
  const frameRef = useRef<number | null>(null);
  const [previewMode, setPreviewMode] = useState("desktop");
  const [countdownStop, setCountdownStop] = useState(false);

  useEffect(() => {
    if (product) {
      setShowFormbricksSignature(product.formbricksSignature);
    }
  }, [product]);

  const handleStopCountdown = () => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      setCountdownStop(true);
    }
  };

  useEffect(() => {
    if (!autoClose) return;
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
    }

    const frame = () => {
      if (!autoClose || !startRef.current) return;

      const timeout = autoClose * 1000;
      const elapsed = performance.now() - startRef.current;
      const remaining = Math.max(0, timeout - elapsed);

      setCountdownProgress(remaining / timeout);

      if (remaining > 0) {
        frameRef.current = requestAnimationFrame(frame);
      } else {
        handleStopCountdown();
        setIsModalOpen(false);
        // reopen the modal after 1 second
        setTimeout(() => {
          setIsModalOpen(true);
          setActiveQuestionId(questions[0]?.id || ""); // set first question as active
        }, 1500);
      }
    };

    setCountdownStop(false);
    setCountdownProgress(1);
    startRef.current = performance.now();
    frameRef.current = requestAnimationFrame(frame);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [autoClose]);

  useEffect(() => {
    if (activeQuestionId) {
      setLastActiveQuestionId(activeQuestionId);
      setProgress(calculateProgress(questions, activeQuestionId));
    } else if (lastActiveQuestionId) {
      setProgress(calculateProgress(questions, lastActiveQuestionId));
    }

    function calculateProgress(questions, activeQuestionId) {
      if (activeQuestionId === "thank-you-card") return 1;

      const elementIdx = questions.findIndex((e) => e.id === activeQuestionId);
      return elementIdx / questions.length;
    }
  }, [activeQuestionId, lastActiveQuestionId, questions]);

  useEffect(() => {
    // close modal if there are no questions left
    if (surveyType === "web" && !thankYouCard.enabled) {
      if (activeQuestionId === "thank-you-card") {
        setIsModalOpen(false);
        setTimeout(() => {
          setActiveQuestionId(questions[0].id);
          setIsModalOpen(true);
        }, 500);
      }
    }
  }, [activeQuestionId, surveyType, questions, setActiveQuestionId, thankYouCard]);

  function evaluateCondition(logic: Logic, answerValue: any): boolean {
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

  function getNextQuestion(answer: any): string {
    // extract activeQuestionId from answer to make it work when form is collapsed.
    const activeQuestionId = Object.keys(answer)[0];
    if (!activeQuestionId) return "";

    const currentQuestionIndex = questions.findIndex((q) => q.id === activeQuestionId);
    if (currentQuestionIndex === -1) throw new Error("Question not found");

    const answerValue = answer[activeQuestionId];
    const currentQuestion = questions[currentQuestionIndex];

    if (currentQuestion.logic && currentQuestion.logic.length > 0) {
      for (let logic of currentQuestion.logic) {
        if (!logic.destination) continue;

        if (evaluateCondition(logic, answerValue)) {
          return logic.destination;
        }
      }
    }
    return questions[currentQuestionIndex + 1]?.id || "end";
  }

  const gotoNextQuestion = (data) => {
    const nextQuestionId = getNextQuestion(data);

    if (nextQuestionId !== "end") {
      setActiveQuestionId(nextQuestionId);
    } else {
      if (thankYouCard?.enabled) {
        setActiveQuestionId("thank-you-card");
        setProgress(1);
      } else {
        setIsModalOpen(false);
        setTimeout(() => {
          setActiveQuestionId(questions[0].id);
          setIsModalOpen(true);
        }, 500);
      }
    }
  };

  useEffect(() => {
    if (environment && environment.widgetSetupCompleted) {
      setWidgetSetupCompleted(true);
    } else {
      setWidgetSetupCompleted(false);
    }
  }, [environment]);

  if (!previewType) {
    previewType = widgetSetupCompleted ? "modal" : "fullwidth";

    if (!activeQuestionId) {
      return <></>;
    }
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-items-center">
      {previewMode === "mobile" && (
        <div className="flex h-full w-5/6 items-center justify-center rounded-lg border border-slate-300 bg-slate-200">
          <div className="relative h-[90%] w-1/2 overflow-hidden rounded-[3rem] border-8 border-slate-500 bg-slate-400">
            {/* below element is use to create notch for the mobile device mockup   */}
            <div className="absolute top-0 right-1/2 left-1/2 transform -translate-x-1/2 h-6 w-1/2 rounded-b-md bg-slate-500 z-20"></div>
            {previewType === "modal" ?
              (<Modal isOpen={isModalOpen} placement={product.placement} previewMode="mobile">
                {!countdownStop && autoClose !== null && autoClose > 0 && (
                  <Progress progress={countdownProgress} brandColor={brandColor} />
                )}
                <PreviewModalContent
                  handleStopCountdown={handleStopCountdown}
                  activeQuestionId={activeQuestionId}
                  lastActiveQuestionId={lastActiveQuestionId}
                  thankYouCard={thankYouCard}
                  questions={questions}
                  brandColor={brandColor}
                  gotoNextQuestion={gotoNextQuestion}
                  showFormbricksSignature={showFormbricksSignature}
                  progress={progress}
                />
              </Modal>) :
              (<div className="h-full w-full flex flex-grow flex-col overflow-y-auto absolute top-0 z-10">
                <div className="flex w-full flex-grow flex-col items-center justify-center bg-white py-6">
                  <div className="w-full max-w-md px-4">
                    <QuestionRenderer
                      activeQuestionId={activeQuestionId}
                      lastActiveQuestionId={lastActiveQuestionId}
                      questions={questions}
                      brandColor={brandColor}
                      thankYouCard={thankYouCard}
                      gotoNextQuestion={gotoNextQuestion}
                    />
                  </div>
                </div>
                <div className="z-10 w-full rounded-b-lg bg-white">
                  <div className="mx-auto max-w-md space-y-6 p-6 pt-4">
                    <Progress progress={progress} brandColor={brandColor} />
                    {showFormbricksSignature && <FormbricksSignature />}
                  </div>
                </div>
              </div>)
            }

          </div>
        </div>
      )}
      {previewMode === "desktop" && (
        <div className="flex h-full w-5/6 flex-1 flex-col rounded-lg border border-slate-300 bg-slate-200 ">
          <div className="flex h-8 items-center rounded-t-lg bg-slate-200">
            <div className="ml-6 flex space-x-2">
              <div className="h-3 w-3 rounded-full bg-red-500"></div>
              <div className="h-3 w-3 rounded-full bg-amber-500"></div>
              <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
            </div>
            <p>
              <span className="ml-4 font-mono text-sm text-slate-400">
                {previewType === "modal" ? "Your web app" : "Preview"}
              </span>
            </p>
          </div>

          {previewType === "modal" ? (
            <Modal isOpen={isModalOpen} placement={product.placement} previewMode="desktop">
              {!countdownStop && autoClose !== null && autoClose > 0 && (
                <Progress progress={countdownProgress} brandColor={brandColor} />
              )}
              <PreviewModalContent
                handleStopCountdown={handleStopCountdown}
                activeQuestionId={activeQuestionId}
                lastActiveQuestionId={lastActiveQuestionId}
                thankYouCard={thankYouCard}
                questions={questions}
                brandColor={brandColor}
                gotoNextQuestion={gotoNextQuestion}
                showFormbricksSignature={showFormbricksSignature}
                progress={progress}
              />
            </Modal>
          ) : (
            <div className="flex flex-grow flex-col overflow-y-auto">
              <div className="flex w-full flex-grow flex-col items-center justify-center bg-white py-6">
                <div className="w-full max-w-md">
                  <QuestionRenderer
                    activeQuestionId={activeQuestionId}
                    lastActiveQuestionId={lastActiveQuestionId}
                    questions={questions}
                    brandColor={brandColor}
                    thankYouCard={thankYouCard}
                    gotoNextQuestion={gotoNextQuestion}
                  />
                </div>
              </div>
              <div className="z-10 w-full rounded-b-lg bg-white">
                <div className="mx-auto max-w-md space-y-6 p-6 pt-4">
                  <Progress progress={progress} brandColor={brandColor} />
                  {showFormbricksSignature && <FormbricksSignature />}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="mt-2 flex rounded-full border-2 border-slate-300 p-1">
        <TabOption
          active={previewMode === "mobile"}
          icon={<DevicePhoneMobileIcon className="mx-4 my-2 h-4 w-4 text-slate-700" />}
          onClick={() => setPreviewMode("mobile")}
        />
        <TabOption
          active={previewMode === "desktop"}
          icon={<ComputerDesktopIcon className="mx-4 my-2 h-4 w-4 text-slate-700" />}
          onClick={() => setPreviewMode("desktop")}
        />
      </div>
    </div>
  );
}
