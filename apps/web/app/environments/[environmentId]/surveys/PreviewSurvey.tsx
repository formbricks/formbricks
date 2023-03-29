import Modal from "@/components/preview/Modal";
import MultipleChoiceSingleQuestion from "@/components/preview/MultipleChoiceSingleQuestion";
import OpenTextQuestion from "@/components/preview/OpenTextQuestion";
import type { Question } from "@formbricks/types/questions";
import { useEffect, useState } from "react";

interface PreviewSurveyProps {
  activeQuestionId?: string | null;
  questions: Question[];
  brandColor: string;
}

export default function PreviewSurvey({ activeQuestionId, questions, brandColor }: PreviewSurveyProps) {
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);

  useEffect(() => {
    if (activeQuestionId) {
      if (currentQuestion && currentQuestion.id === activeQuestionId) {
        setCurrentQuestion(questions.find((q) => q.id === activeQuestionId) || null);
        return;
      }
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
  }, [activeQuestionId, questions]);

  const gotoNextQuestion = () => {
    if (currentQuestion) {
      const currentIndex = questions.findIndex((q) => q.id === currentQuestion.id);
      if (currentIndex < questions.length - 1) {
        setCurrentQuestion(questions[currentIndex + 1]);
      } else {
        // start over
        setIsModalOpen(false);
        setTimeout(() => {
          setCurrentQuestion(questions[0]);
          setIsModalOpen(true);
        }, 500);
      }
    }
  };

  if (!currentQuestion) {
    return null;
  }

  const lastQuestion = currentQuestion.id === questions[questions.length - 1].id;

  return (
    <Modal isOpen={isModalOpen}>
      {currentQuestion.type === "openText" ? (
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
