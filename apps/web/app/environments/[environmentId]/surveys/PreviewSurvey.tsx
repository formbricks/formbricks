import Modal from "@/components/preview/Modal";
import Progress from "@/components/preview/Progress";
import QuestionConditional from "@/components/preview/QuestionConditional";
import ThankYouCard from "@/components/preview/ThankYouCard";
import ContentWrapper from "@/components/shared/ContentWrapper";
import type { Question } from "@formbricks/types/questions";
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
}: PreviewSurveyProps) {
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [progress, setProgress] = useState(0); // [0, 1]

  useEffect(() => {
    if (currentQuestion && localSurvey) {
      setProgress(calculateProgress(currentQuestion, localSurvey));
    }

    function calculateProgress(currentQuestion, survey) {
      const elementIdx = survey.questions.findIndex((e) => e.id === currentQuestion.id);
      return elementIdx / survey.questions.length;
    }
  }, [currentQuestion, localSurvey]);

  useEffect(() => {
    // close modal if there are no questions left
    if (localSurvey?.type === "web" && !localSurvey?.thankYouCard.enabled) {
      if (activeQuestionId === "thank-you-card") {
        setIsModalOpen(false);
        setTimeout(() => {
          setCurrentQuestion(questions[0]);
          setActiveQuestionId(questions[0].id);
          setIsModalOpen(true);
        }, 500);
      }
    }
  }, [activeQuestionId, localSurvey, questions, setActiveQuestionId]);

  useEffect(() => {
    const currentIndex = questions.findIndex((q) => q.id === currentQuestion?.id);
    if (currentIndex < questions.length && currentIndex >= 0 && !localSurvey) return;

    if (activeQuestionId) {
      if (currentQuestion && currentQuestion.id === activeQuestionId) {
        setCurrentQuestion(questions.find((q) => q.id === activeQuestionId) || null);
        return;
      }
      if (activeQuestionId === "thank-you-card") return;

      setIsModalOpen(false);
      setTimeout(() => {
        setCurrentQuestion(questions.find((q) => q.id === activeQuestionId) || null);
        setIsModalOpen(true);
      }, 300);
    } else {
      if (questions && questions.length > 0) {
        setCurrentQuestion(questions[0]);
      }
    }
  }, [activeQuestionId, currentQuestion, localSurvey, questions]);

  const gotoNextQuestion = () => {
    if (currentQuestion) {
      const currentIndex = questions.findIndex((q) => q.id === currentQuestion.id);
      if (currentIndex < questions.length - 1) {
        setCurrentQuestion(questions[currentIndex + 1]);
        setActiveQuestionId(questions[currentIndex + 1].id);
      } else {
        if (localSurvey?.thankYouCard?.enabled) {
          setActiveQuestionId("thank-you-card");
          setProgress(1);
        } else {
          setIsModalOpen(false);
          setTimeout(() => {
            setCurrentQuestion(questions[0]);
            setActiveQuestionId(questions[0].id);
            setIsModalOpen(true);
          }, 500);
        }
      }
    }
  };

  const resetPreview = () => {
    setIsModalOpen(false);
    setTimeout(() => {
      setCurrentQuestion(questions[0]);
      setActiveQuestionId(questions[0].id);
      setIsModalOpen(true);
    }, 500);
  };

  if (!currentQuestion) {
    return null;
  }

  const lastQuestion = questions.length > 0 && currentQuestion.id === questions[questions.length - 1].id;

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
            <ContentWrapper className="max-w-lg sm:max-w-xl md:max-w-2xl lg:max-w-3xl">
              {activeQuestionId == "thank-you-card" ? (
                <ThankYouCard
                  brandColor={brandColor}
                  headline={localSurvey?.thankYouCard?.headline || ""}
                  subheader={localSurvey?.thankYouCard?.subheader || ""}
                />
              ) : (
                <QuestionConditional
                  currentQuestion={currentQuestion}
                  brandColor={brandColor}
                  lastQuestion={lastQuestion}
                  onSubmit={gotoNextQuestion}
                />
              )}
            </ContentWrapper>
          </div>
          <div className="top-0 z-10 w-full border-b bg-white">
            <div className="mx-auto max-w-lg p-6">
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
            <QuestionConditional
              currentQuestion={currentQuestion}
              brandColor={brandColor}
              lastQuestion={lastQuestion}
              onSubmit={gotoNextQuestion}
            />
          )}
        </Modal>
      )}
    </>
  );
}
