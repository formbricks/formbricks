import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { Project } from "@prisma/client";
import { TI18nString } from "@formbricks/types/i18n";
import { TSurveyBlockLogic } from "@formbricks/types/surveys/blocks";
import { TSurveyElement } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { BlockCard } from "@/modules/survey/editor/components/block-card";

interface BlocksDroppableProps {
  localSurvey: TSurvey;
  setLocalSurvey: (survey: TSurvey) => void;
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
  activeQuestionId: string | null;
  setActiveQuestionId: (questionId: string | null) => void;
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
  duplicateBlock: (blockId: string) => void;
  deleteBlock: (blockId: string) => void;
  moveBlock: (blockId: string, direction: "up" | "down") => void;
  addElementToBlock: (element: TSurveyElement, questionIdx: number) => void;
}

export const BlocksDroppable = ({
  activeQuestionId,
  deleteQuestion,
  duplicateQuestion,
  invalidQuestions,
  localSurvey,
  setLocalSurvey,
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
  duplicateBlock,
  deleteBlock,
  moveBlock,
  addElementToBlock,
}: BlocksDroppableProps) => {
  const [parent] = useAutoAnimate();

  return (
    <div className="group mb-5 flex w-full flex-col gap-5" ref={parent}>
      <SortableContext items={localSurvey.blocks} strategy={verticalListSortingStrategy}>
        {localSurvey.blocks.map((block, blockIdx) => {
          // Check if this is the last block and has elements
          const isLastBlock = blockIdx === localSurvey.blocks.length - 1;
          const lastElementIndex = block.elements.length - 1;

          return (
            <BlockCard
              key={block.id}
              localSurvey={localSurvey}
              setLocalSurvey={setLocalSurvey}
              project={project}
              block={block}
              blockIdx={blockIdx}
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
              lastQuestion={isLastBlock}
              lastElementIndex={lastElementIndex}
              invalidQuestions={invalidQuestions ?? undefined}
              addQuestion={addQuestion}
              isFormbricksCloud={isFormbricksCloud}
              isCxMode={isCxMode}
              locale={locale}
              responseCount={responseCount}
              onAlertTrigger={onAlertTrigger}
              isStorageConfigured={isStorageConfigured}
              isExternalUrlsAllowed={isExternalUrlsAllowed}
              duplicateBlock={duplicateBlock}
              deleteBlock={deleteBlock}
              moveBlock={moveBlock}
              addElementToBlock={addElementToBlock}
              totalBlocks={localSurvey.blocks.length}
            />
          );
        })}
      </SortableContext>
    </div>
  );
};
