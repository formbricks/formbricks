import Modal from "@/components/preview/Modal";
import OpenTextQuestion from "@/components/preview/OpenTextQuestion";
import type { Question } from "@/types/questions";
import { useEffect, useMemo, useState } from "react";

interface PreviewProps {
  activeQuestionId: string | null;
  questions: Question[];
}

export default function Preview({ activeQuestionId, questions }: PreviewProps) {
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
      <OpenTextQuestion question={question} onSubmit={() => {}} lastQuestion={false} />
    </Modal>
  );
}
