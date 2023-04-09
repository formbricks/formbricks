import { Survey } from "@formbricks/types/surveys";
import Modal from "@/components/preview/Modal";
import MultipleChoiceSingleQuestion from "@/components/preview/MultipleChoiceSingleQuestion";
import OpenTextQuestion from "@/components/preview/OpenTextQuestion";
import ThankYouCard from "@/components/preview/ThankYouCard";
import type { Question } from "@formbricks/types/questions";
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

  useEffect(() => {
    const currentIndex = questions.findIndex((q) => q.id === currentQuestion?.id);
    if (currentIndex < questions.length && currentIndex >= 0) return;

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
  }, [activeQuestionId, currentQuestion, questions]);

  const gotoNextQuestion = () => {
    if (currentQuestion) {
      const currentIndex = questions.findIndex((q) => q.id === currentQuestion.id);
      if (currentIndex < questions.length - 1) {
        setCurrentQuestion(questions[currentIndex + 1]);
      } else {
        setActiveQuestionId("thank-you-card");
      }
    }
  };

  if (!currentQuestion) {
    return null;
  }

  const lastQuestion = currentQuestion.id === questions[questions.length - 1].id;

  return (
    <Modal isOpen={isModalOpen}>
      {activeQuestionId == "thank-you-card" ? (
        <ThankYouCard
          brandColor={brandColor}
          headline={localSurvey?.thankYouCard?.headline || "Thank you for your help!"}
          subheader={localSurvey?.thankYouCard?.subheader || "Thanks for helping to make our product better!"}
        />
      ) : currentQuestion.type === "openText" ? (
        <OpenTextQuestion
          question={currentQuestion}
          onSubmit={() => gotoNextQuestion()}
          lastQuestion={lastQuestion}
          brandColor={brandColor}
        />
      ) : currentQuestion.type === "multipleChoiceSingle" ? (
        <MultipleChoiceSingleQuestion
          question={currentQuestion}
          onSubmit={() => gotoNextQuestion()}
          lastQuestion={lastQuestion}
          brandColor={brandColor}
        />
      ) : null}
    </Modal>
  );
}
