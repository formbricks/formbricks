import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TProduct } from "@formbricks/types/product";
import { TSurvey, TSurveyQuestionId } from "@formbricks/types/surveys/types";
import { QuestionCard } from "./QuestionCard";

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
  contactAttributeKeys: TContactAttributeKey[];
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
  contactAttributeKeys,
  addQuestion,
  isFormbricksCloud,
  isCxMode,
}: QuestionsDraggableProps) => {
  const [parent] = useAutoAnimate();

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
            contactAttributeKeys={contactAttributeKeys}
            addQuestion={addQuestion}
            isFormbricksCloud={isFormbricksCloud}
            isCxMode={isCxMode}
          />
        ))}
      </SortableContext>
    </div>
  );
};
