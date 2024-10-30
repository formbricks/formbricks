import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TProduct } from "@formbricks/types/product";
import { TSurvey, TSurveyQuestionId } from "@formbricks/types/surveys/types";
import { QuestionCard } from "./QuestionCard";
import { useEffect, useState } from "react";

interface QuestionsDraggableProps {
  localSurvey: TSurvey;
  product: TProduct;
  moveQuestion: (questionIndex: number, up: boolean) => void;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  deleteQuestion: (questionIdx: number) => void;
  duplicateQuestion: (questionIdx: number) => void;
  activeQuestionId: TSurveyQuestionId | null;
  setActiveQuestionId: (questionId: TSurveyQuestionId | null) => void;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (language: string) => void;
  invalidQuestions: string[] | null;
  internalQuestionIdMap: Record<string, string>;
  attributeClasses: TAttributeClass[];
  addQuestion: (question: any, index?: number) => void;
  isFormbricksCloud: boolean;
  isCxMode: boolean;
}

export const QuestionsDroppable = ({
  activeQuestionId,
  deleteQuestion,
  duplicateQuestion,
  invalidQuestions,
  localSurvey,
  moveQuestion,
  product,
  selectedLanguageCode,
  setActiveQuestionId,
  setSelectedLanguageCode,
  updateQuestion,
  internalQuestionIdMap,
  attributeClasses,
  addQuestion,
  isFormbricksCloud,
  isCxMode,
}: QuestionsDraggableProps) => {
  const [parent] = useAutoAnimate();
  const [originalIndex, setOriginalIndex] = useState<number | null>(null);

  const handleKeyDown = (event: KeyboardEvent) => {
    if (activeQuestionId === null) return;

    const currentIndex = localSurvey.questions.findIndex(
      (question) => question.id === activeQuestionId
    );

    switch (event.key) {
      case "ArrowUp":
        if (currentIndex > 0) {
          moveQuestion(currentIndex, true);
        }
        break;
      case "ArrowDown":
        if (currentIndex < localSurvey.questions.length - 1) {
          moveQuestion(currentIndex, false);
        }
        break;
      case "Enter":
        setOriginalIndex(null);
        break;
      case "Escape":
        if (originalIndex !== null) {
          moveQuestion(currentIndex, currentIndex > originalIndex);
          setOriginalIndex(null);
        }
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
  }, [activeQuestionId, originalIndex, localSurvey.questions]);

  return (
    <div className="group mb-5 flex w-full flex-col gap-5" ref={parent}>
      <SortableContext items={localSurvey.questions} strategy={verticalListSortingStrategy}>
        {localSurvey.questions.map((question, questionIdx) => (
          <QuestionCard
            key={internalQuestionIdMap[question.id]}
            localSurvey={localSurvey}
            product={product}
            question={question}
            questionIdx={questionIdx}
            moveQuestion={moveQuestion}
            updateQuestion={updateQuestion}
            duplicateQuestion={duplicateQuestion}
            selectedLanguageCode={selectedLanguageCode}
            setSelectedLanguageCode={setSelectedLanguageCode}
            deleteQuestion={deleteQuestion}
            activeQuestionId={activeQuestionId}
            setActiveQuestionId={setActiveQuestionId}
            lastQuestion={questionIdx === localSurvey.questions.length - 1}
            isInvalid={invalidQuestions ? invalidQuestions.includes(question.id) : false}
            attributeClasses={attributeClasses}
            addQuestion={addQuestion}
            isFormbricksCloud={isFormbricksCloud}
            isCxMode={isCxMode}
          />
        ))}
      </SortableContext>
    </div>
  );
};
