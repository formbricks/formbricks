import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { Project } from "@prisma/client";
import { useMemo } from "react";
import { TI18nString } from "@formbricks/types/i18n";
import { TSurveyBlockLogic } from "@formbricks/types/surveys/blocks";
import { TSurvey, TSurveyQuestion, TSurveyQuestionId } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { QuestionCard } from "@/modules/survey/editor/components/question-card";

interface QuestionsDraggableProps {
  localSurvey: TSurvey;
  project: Project;
  moveQuestion: (questionIndex: number, up: boolean) => void;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  updateBlockLogic: (questionIdx: number, logic: TSurveyBlockLogic[]) => void;
  updateBlockLogicFallback: (questionIdx: number, logicFallback: string | undefined) => void;
  updateBlockButtonLabel: (
    blockIndex: number,
    labelKey: "buttonLabel" | "backButtonLabel",
    labelValue: TI18nString | undefined
  ) => void;
  deleteQuestion: (questionIdx: number) => void;
  duplicateQuestion: (questionIdx: number) => void;
  activeQuestionId: TSurveyQuestionId | null;
  setActiveQuestionId: (questionId: TSurveyQuestionId | null) => void;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (language: string) => void;
  invalidQuestions: string[] | null;
  addQuestion: (question: any, index?: number) => void;
  isFormbricksCloud: boolean;
  isCxMode: boolean;
  locale: TUserLocale;
  responseCount: number;
  onAlertTrigger: () => void;
  isStorageConfigured: boolean;
  isExternalUrlsAllowed: boolean;
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
  setSelectedLanguageCode,
  updateQuestion,
  updateBlockLogic,
  updateBlockLogicFallback,
  updateBlockButtonLabel,
  addQuestion,
  isFormbricksCloud,
  isCxMode,
  locale,
  responseCount,
  onAlertTrigger,
  isStorageConfigured = true,
  isExternalUrlsAllowed,
}: QuestionsDraggableProps) => {
  const [parent] = useAutoAnimate();

  // Derive questions from blocks for display
  const questions = useMemo(() => {
    return localSurvey.blocks.flatMap((block) => block.elements);
  }, [localSurvey.blocks]);

  return (
    <div className="group mb-5 flex w-full flex-col gap-5" ref={parent}>
      <SortableContext items={questions} strategy={verticalListSortingStrategy}>
        {questions.map((question, questionIdx) => (
          <QuestionCard
            key={question.id}
            localSurvey={localSurvey}
            project={project}
            question={question as unknown as TSurveyQuestion}
            questionIdx={questionIdx}
            moveQuestion={moveQuestion}
            updateQuestion={updateQuestion}
            updateBlockLogic={updateBlockLogic}
            updateBlockLogicFallback={updateBlockLogicFallback}
            updateBlockButtonLabel={updateBlockButtonLabel}
            duplicateQuestion={duplicateQuestion}
            selectedLanguageCode={selectedLanguageCode}
            setSelectedLanguageCode={setSelectedLanguageCode}
            deleteQuestion={deleteQuestion}
            activeQuestionId={activeQuestionId}
            setActiveQuestionId={setActiveQuestionId}
            lastQuestion={questionIdx === questions.length - 1}
            isInvalid={invalidQuestions ? invalidQuestions.includes(question.id) : false}
            addQuestion={addQuestion}
            isFormbricksCloud={isFormbricksCloud}
            isCxMode={isCxMode}
            locale={locale}
            responseCount={responseCount}
            onAlertTrigger={onAlertTrigger}
            isStorageConfigured={isStorageConfigured}
            isExternalUrlsAllowed={isExternalUrlsAllowed}
          />
        ))}
      </SortableContext>
    </div>
  );
};
