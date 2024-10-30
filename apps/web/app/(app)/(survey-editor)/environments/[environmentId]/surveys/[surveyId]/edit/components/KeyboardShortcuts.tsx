import { useEffect } from "react";

interface KeyboardShortcutsProps {
  activeQuestionId: string | null;
  moveQuestion: (questionIndex: number, up: boolean) => void;
  finalizePosition: () => void;
  resetPosition: () => void;
  questions: { id: string }[];
}

const KeyboardShortcuts = ({
  activeQuestionId,
  moveQuestion,
  finalizePosition,
  resetPosition,
  questions,
}: KeyboardShortcutsProps) => {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (activeQuestionId === null) return;

    const currentIndex = questions.findIndex((question) => question.id === activeQuestionId);

    switch (event.key) {
      case "ArrowUp":
        if (currentIndex > 0) {
          moveQuestion(currentIndex, true);
        }
        break;
      case "ArrowDown":
        if (currentIndex < questions.length - 1) {
          moveQuestion(currentIndex, false);
        }
        break;
      case "Enter":
        finalizePosition();
        break;
      case "Escape":
        resetPosition();
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeQuestionId, questions]);

  return null;
};

export default KeyboardShortcuts;
