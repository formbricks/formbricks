import { QuestionCard } from "@/modules/survey/editor/components/question-card";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { Project } from "@prisma/client";
import { TSurvey, TSurveyQuestionId } from "@formbricks/types/surveys/types";

interface QuestionsDraggableProps {
  localSurvey: TSurvey;
  project: Project;
  moveQuestion: (questionIndex: number, up: boolean) => void;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  deleteQuestion: (questionIdx: number) => void;
  duplicateQuestion: (questionIdx: number) => void;
  activeQuestionId: TSurveyQuestionId | null;
  setActiveQuestionId: (questionId: TSurveyQuestionId | null) => void;
  selectedLanguageCode: string;
  invalidQuestions: string[] | null;
  addQuestion: (question: any, index?: number) => void;
  isCxMode: boolean;
}

export const QuestionsDroppable = ({
  activeQuestionId,
  deleteQuestion,
  duplicateQuestion,
  invalidQuestions,
  localSurvey,
  moveQuestion,
  project,
  selectedLanguageCode,
  setActiveQuestionId,
  updateQuestion,
  addQuestion,
  isCxMode,
}: QuestionsDraggableProps) => {
  const [parent] = useAutoAnimate();

  return (
    <div className="group mb-5 flex w-full flex-col gap-5" ref={parent}>
      <SortableContext items={localSurvey.questions} strategy={verticalListSortingStrategy}>
        {localSurvey.questions.map((question, questionIdx) => (
          <QuestionCard
            key={question.id}
            localSurvey={localSurvey}
            project={project}
            question={question}
            questionIdx={questionIdx}
            moveQuestion={moveQuestion}
            updateQuestion={updateQuestion}
            duplicateQuestion={duplicateQuestion}
            selectedLanguageCode={selectedLanguageCode}
            deleteQuestion={deleteQuestion}
            activeQuestionId={activeQuestionId}
            setActiveQuestionId={setActiveQuestionId}
            lastQuestion={questionIdx === localSurvey.questions.length - 1}
            isInvalid={invalidQuestions ? invalidQuestions.includes(question.id) : false}
            addQuestion={addQuestion}
            isCxMode={isCxMode}
          />
        ))}
      </SortableContext>
    </div>
  );
};
