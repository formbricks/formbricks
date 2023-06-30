import FormbricksSignature from "@/components/preview/FormbricksSignature";
import Modal from "@/components/preview/Modal";
import Progress from "@/components/preview/Progress";
import QuestionConditional from "@/components/preview/QuestionConditional";
import ThankYouCard from "@/components/preview/ThankYouCard";
import { useEnvironment } from "@/lib/environments/environments";
import { useProduct } from "@/lib/products/products";
import type { Logic, Question } from "@formbricks/types/questions";
import { Survey } from "@formbricks/types/surveys";
import { useEffect, useRef, useState } from "react";

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
}

export default function PreviewSurvey({
  setActiveQuestionId,
  activeQuestionId,
  questions,
  brandColor,
  environmentId,
  surveyType,
  thankYouCard,
  autoClose,
  previewType,
}: PreviewSurveyProps) {
  const { environment } = useEnvironment(environmentId);
  const { product } = useProduct(environmentId);

  const [isModalOpen, setIsModalOpen] = useState(true);
  const [progress, setProgress] = useState(0); // [0, 1]
  const [widgetSetupCompleted, setWidgetSetupCompleted] = useState(false);
  const [lastActiveQuestionId, setLastActiveQuestionId] = useState("");
  const [showFormbricksSignature, setShowFormbricksSignature] = useState(false);

  useEffect(() => {
    if (product) {
      setShowFormbricksSignature(product.formbricksSignature);
    }
  }, [product]);

  const [countdownProgress, setCountdownProgress] = useState(1);
  const startRef = useRef(performance.now());
  const frameRef = useRef<number | null>(null);
  const [countdownStop, setCountdownStop] = useState(false);

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
    <div className="my-4 flex h-full w-5/6 flex-col rounded-lg border border-slate-300 bg-slate-200 ">
      <div className="flex h-8 items-center rounded-t-lg bg-slate-100">
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
        <Modal isOpen={isModalOpen} placement={product.placement}>
          {!countdownStop && autoClose !== null && autoClose > 0 && (
            <Progress progress={countdownProgress} brandColor={brandColor} />
          )}
          <div
            onClick={() => handleStopCountdown()}
            onMouseOver={() => handleStopCountdown()}
            className="px-4 py-6 sm:p-6">
            {(activeQuestionId || lastActiveQuestionId) === "thank-you-card" ? (
              <ThankYouCard
                brandColor={brandColor}
                headline={thankYouCard?.headline || "Thank you!"}
                subheader={thankYouCard?.subheader || "We appreciate your feedback."}
              />
            ) : (
              questions.map((question, idx) =>
                (activeQuestionId || lastActiveQuestionId) === question.id ? (
                  <QuestionConditional
                    key={question.id}
                    question={question}
                    brandColor={brandColor}
                    lastQuestion={idx === questions.length - 1}
                    onSubmit={gotoNextQuestion}
                  />
                ) : null
              )
            )}
            {showFormbricksSignature && <FormbricksSignature />}
          </div>
          <Progress progress={progress} brandColor={brandColor} />
        </Modal>
      ) : (
        <div className="flex flex-grow flex-col">
          <div className="flex  w-full flex-grow flex-col items-center justify-center bg-white py-6">
            <div className="w-full max-w-md">
              {(activeQuestionId || lastActiveQuestionId) === "thank-you-card" ? (
                <ThankYouCard
                  brandColor={brandColor}
                  headline={thankYouCard?.headline || "Thank you!"}
                  subheader={thankYouCard?.subheader || "We appreciate your feedback."}
                />
              ) : (
                questions.map((question, idx) =>
                  (activeQuestionId || lastActiveQuestionId) === question.id ? (
                    <QuestionConditional
                      key={question.id}
                      question={question}
                      brandColor={brandColor}
                      lastQuestion={idx === questions.length - 1}
                      onSubmit={gotoNextQuestion}
                    />
                  ) : null
                )
              )}
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
  );
}
