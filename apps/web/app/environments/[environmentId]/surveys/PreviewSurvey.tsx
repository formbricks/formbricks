import Modal from "@/components/preview/Modal";
import Progress from "@/components/preview/Progress";
import QuestionConditional from "@/components/preview/QuestionConditional";
import ThankYouCard from "@/components/preview/ThankYouCard";
import ContentWrapper from "@/components/shared/ContentWrapper";
import type { Logic, Question } from "@formbricks/types/questions";
import { Survey } from "@formbricks/types/surveys";
import { ArrowPathIcon } from "@heroicons/react/24/solid";
import { useEffect, useState } from "react";

interface PreviewSurveyProps {
  localSurvey?: Survey;
  setActiveQuestionId: (id: string | null) => void;
  activeQuestionId?: string | null;
  questions: Question[];
  brandColor: string;
}

export default function PreviewSurvey({
  localSurvey,
  setActiveQuestionId,
  activeQuestionId,
  questions,
  brandColor,
}: PreviewSurveyProps): JSX.Element {
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [progress, setProgress] = useState(0); // [0, 1]

  useEffect(() => {
    if (activeQuestionId && localSurvey) {
      setProgress(calculateProgress(localSurvey));
    }

    function calculateProgress(survey) {
      const elementIdx = survey.questions.findIndex((e) => e.id === activeQuestionId);
      return elementIdx / survey.questions.length;
    }
  }, [activeQuestionId, localSurvey]);

  useEffect(() => {
    // close modal if there are no questions left
    if (localSurvey?.type === "web" && !localSurvey?.thankYouCard.enabled) {
      if (activeQuestionId === "thank-you-card") {
        setIsModalOpen(false);
        setTimeout(() => {
          setActiveQuestionId(questions[0].id);
          setIsModalOpen(true);
        }, 500);
      }
    }
  }, [activeQuestionId, localSurvey, questions, setActiveQuestionId]);

  function evaluateCondition(logic: Logic, answerValue: any): boolean {
    switch (logic.condition) {
      case "equals":
        return (
          (Array.isArray(answerValue) && answerValue.length === 1 && answerValue.includes(logic.value)) ||
          answerValue === logic.value
        );
      case "notEquals":
        return answerValue !== logic.value;
      case "lessThan":
        return answerValue < logic.value;
      case "lessEqual":
        return answerValue <= logic.value;
      case "greaterThan":
        return answerValue > logic.value;
      case "greaterEqual":
        return answerValue >= logic.value;
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
      case "submitted":
        return (Array.isArray(answerValue) && answerValue.length > 0) || answerValue !== "";
      case "skipped":
        return (Array.isArray(answerValue) && answerValue.length === 0) || answerValue === "";
      default:
        return false;
    }
  }

  function getNextQuestion(answer: any): string {
    if (!localSurvey || !activeQuestionId) return "";

    const questions = localSurvey.questions;

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
    return questions[currentQuestionIndex + 1]?.id || "";
  }

  const gotoNextQuestion = (data) => {
    const currentIndex = questions.findIndex((q) => q.id === activeQuestionId);
    const nextQuestionId = getNextQuestion(data);

    if (currentIndex < questions.length - 1 && nextQuestionId !== "end") {
      setActiveQuestionId(nextQuestionId);
      // setActiveQuestionId(questions[currentIndex + 1].id);
    } else {
      if (localSurvey?.thankYouCard?.enabled) {
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

  const resetPreview = () => {
    setIsModalOpen(false);
    setTimeout(() => {
      setActiveQuestionId(questions[0].id);
      setIsModalOpen(true);
    }, 500);
  };

  if (!activeQuestionId) {
    return <></>;
  }

  return (
    <>
      {localSurvey?.type === "link" ? (
        <div className="relative flex h-full flex-1 flex-shrink-0 flex-col overflow-hidden border border-amber-400">
          <div
            className="absolute right-3 mr-6 flex items-center rounded-b bg-amber-500 px-3 text-sm font-semibold text-white opacity-100 transition-all duration-500 ease-in-out hover:cursor-pointer"
            onClick={resetPreview}>
            <ArrowPathIcon className="mr-1.5 mt-0.5 h-4 w-4 " />
            Preview
          </div>
          <div className="flex h-full flex-1 items-center overflow-y-auto bg-white">
            <ContentWrapper className="w-full md:max-w-lg">
              {activeQuestionId == "thank-you-card" ? (
                <ThankYouCard
                  brandColor={brandColor}
                  headline={localSurvey?.thankYouCard?.headline || ""}
                  subheader={localSurvey?.thankYouCard?.subheader || ""}
                />
              ) : (
                questions.map(
                  (question, idx) =>
                    activeQuestionId === question.id && (
                      <QuestionConditional
                        key={question.id}
                        question={question}
                        brandColor={brandColor}
                        lastQuestion={idx === questions.length - 1}
                        onSubmit={gotoNextQuestion}
                      />
                    )
                )
              )}
            </ContentWrapper>
          </div>
          <div className="top-0 z-10 w-full border-b bg-white">
            <div className="mx-auto max-w-md p-6">
              <Progress progress={progress} brandColor={brandColor} />
            </div>
          </div>
        </div>
      ) : (
        <Modal isOpen={isModalOpen} reset={resetPreview}>
          {activeQuestionId == "thank-you-card" ? (
            <ThankYouCard
              brandColor={brandColor}
              headline={localSurvey?.thankYouCard?.headline || ""}
              subheader={localSurvey?.thankYouCard?.subheader || ""}
            />
          ) : (
            questions.map(
              (question, idx) =>
                activeQuestionId === question.id && (
                  <QuestionConditional
                    key={question.id}
                    question={question}
                    brandColor={brandColor}
                    lastQuestion={idx === questions.length - 1}
                    onSubmit={gotoNextQuestion}
                  />
                )
            )
          )}
        </Modal>
      )}
    </>
  );
}
