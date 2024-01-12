import { useState } from "react";

import { getLocalizedValue } from "@formbricks/lib/utils/i18n";
import { TSurvey, TSurveyQuestion } from "@formbricks/types/surveys";

import Modal from "./Modal";
import QuestionConditional from "./QuestionConditional";
import ThankYouCard from "./ThankYouCard";

interface PreviewSurveyProps {
  localSurvey?: TSurvey;
  setActiveQuestionId: (id: string | null) => void;
  activeQuestionId?: string | null;
  questions: TSurveyQuestion[];
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

  const gotoNextQuestion = () => {
    const currentIndex = questions.findIndex((q) => q.id === activeQuestionId);
    if (currentIndex < questions.length - 1) {
      setActiveQuestionId(questions[currentIndex + 1].id);
    } else {
      if (localSurvey?.thankYouCard?.enabled) {
        setActiveQuestionId("thank-you-card");
      } else {
        setIsModalOpen(false);
        setTimeout(() => {
          setActiveQuestionId(questions[0].id);
          setIsModalOpen(true);
        }, 500);
        if (localSurvey?.thankYouCard?.enabled) {
          setActiveQuestionId("thank-you-card");
        } else {
          setIsModalOpen(false);
          setTimeout(() => {
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
      setActiveQuestionId(questions[0].id);
      setIsModalOpen(true);
    }, 500);
  };

  if (!activeQuestionId) {
    return null;
  }

  return (
    <>
      <Modal isOpen={isModalOpen} reset={resetPreview}>
        {activeQuestionId == "thank-you-card" ? (
          <ThankYouCard
            brandColor={brandColor}
            headline={getLocalizedValue(localSurvey?.thankYouCard?.headline, "en") || ""}
            subheader={getLocalizedValue(localSurvey?.thankYouCard?.subheader, "en") || ""}
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
    </>
  );
}
