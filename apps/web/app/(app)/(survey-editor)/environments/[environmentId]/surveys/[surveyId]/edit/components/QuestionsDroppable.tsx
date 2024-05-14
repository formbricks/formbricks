import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

import { TProduct } from "@formbricks/types/product";
import { TSurvey } from "@formbricks/types/surveys";

import { QuestionCard } from "./QuestionCard";

interface QuestionsDraggableProps {
  localSurvey: TSurvey;
  product: TProduct;
  moveQuestion: (questionIndex: number, up: boolean) => void;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  deleteQuestion: (questionIdx: number) => void;
  duplicateQuestion: (questionIdx: number) => void;
  activeQuestionId: string | null;
  setActiveQuestionId: (questionId: string | null) => void;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (language: string) => void;
  invalidQuestions: string[] | null;
  internalQuestionIdMap: Record<string, string>;
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
}: QuestionsDraggableProps) => {
  return (
    <div className="group mb-5 grid w-full gap-5">
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
          />
        ))}
      </SortableContext>
    </div>
  );
};
