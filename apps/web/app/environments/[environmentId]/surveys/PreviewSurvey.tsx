import { Survey } from "@formbricks/types/surveys";
import Modal from "@/components/preview/Modal";
import ThankYouCard from "@/components/preview/ThankYouCard";
import type { Question } from "@formbricks/types/questions";
import { useEffect, useState } from "react";
import QuestionConditional from "@/components/preview/QuestionConditional";

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

  useEffect(() => {
    if (!localSurvey?.thankYouCard.enabled) {
      if (activeQuestionId === "thank-you-card") {
        setIsModalOpen(false);
        setTimeout(() => {
          setCurrentQuestion(questions[0]);
          setActiveQuestionId(questions[0].id);
          setIsModalOpen(true);
        }, 500);
      }
    }
  }, [localSurvey]);

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

  const lastQuestion = currentQuestion.id === questions[questions.length - 1].id;

  return (
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
  );
}
