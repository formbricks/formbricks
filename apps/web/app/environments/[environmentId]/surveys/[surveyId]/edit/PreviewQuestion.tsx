import Modal from "@/components/preview/Modal";
import MultipleChoiceSingleQuestion from "@/components/preview/MultipleChoiceSingleQuestion";
import OpenTextQuestion from "@/components/preview/OpenTextQuestion";
import type { Question } from "@/types/questions";
import { useEffect, useMemo, useState } from "react";

interface PreviewProps {
  activeQuestionId: string | null;
  questions: Question[];
  lastQuestion: boolean;
}

export default function PreviewQuestion({ activeQuestionId, questions, lastQuestion }: PreviewProps) {
  const [isModalOpen, setIsModalOpen] = useState(true);

  useEffect(() => {
    if (activeQuestionId) {
      setIsModalOpen(false);
      setTimeout(() => {
        setIsModalOpen(true);
      }, 300);
    } else {
      setIsModalOpen(false);
    }
  }, [activeQuestionId]);

  const question = useMemo(
    () => questions.find((q) => q.id === activeQuestionId),
    [activeQuestionId, questions]
  );

  if (!question) {
    console.error('Question not found for id "' + activeQuestionId + '"');
    return null;
  }

  return (
    <Modal isOpen={isModalOpen}>
      {question.type === "openText" ? (
        <OpenTextQuestion question={question} onSubmit={() => {}} lastQuestion={lastQuestion} />
      ) : question.type === "multipleChoiceSingle" ? (
        <MultipleChoiceSingleQuestion question={question} onSubmit={() => {}} lastQuestion={lastQuestion} />
      ) : null}
    </Modal>
  );
}
