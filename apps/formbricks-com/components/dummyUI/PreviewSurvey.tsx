import { useEffect, useState } from "react";
import Modal from "./Modal";
import type { Question } from "./questionTypes";
import MultipleChoiceSingleQuestion from "./MultipleChoiceSingleQuestion";
import OpenTextQuestion from "./OpenTextQuestion";

interface PreviewSurveyProps {
  activeQuestionId?: string | null;
  questions: Question[];
  brandColor: string;
}

export const PreviewSurvey: React.FC<PreviewSurveyProps> = ({ activeQuestionId, questions, brandColor }) => {
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
};

export default PreviewSurvey;
