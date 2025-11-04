"use client";

import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { createId } from "@paralleldrive/cuid2";
import { Language, Project } from "@prisma/client";
import React, { SetStateAction, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TI18nString } from "@formbricks/types/i18n";
import { TSurveyQuota } from "@formbricks/types/quota";
import { TSurveyBlock, TSurveyBlockLogic, TSurveyBlockLogicAction } from "@formbricks/types/surveys/blocks";
import { findBlocksWithCyclicLogic } from "@formbricks/types/surveys/blocks-validation";
import { type TConditionGroup, type TSingleCondition } from "@formbricks/types/surveys/logic";
import { TSurvey, TSurveyQuestion, TSurveyQuestionId } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { getDefaultEndingCard } from "@/app/lib/survey-builder";
import { addMultiLanguageLabels, extractLanguageCodes } from "@/lib/i18n/utils";
import { structuredClone } from "@/lib/pollyfills/structuredClone";
import { isConditionGroup } from "@/lib/surveyLogic/utils";
import { checkForEmptyFallBackValue, extractRecallInfo } from "@/lib/utils/recall";
import { MultiLanguageCard } from "@/modules/ee/multi-language-surveys/components/multi-language-card";
import { AddEndingCardButton } from "@/modules/survey/editor/components/add-ending-card-button";
import { AddQuestionButton } from "@/modules/survey/editor/components/add-question-button";
import { EditEndingCard } from "@/modules/survey/editor/components/edit-ending-card";
import { EditWelcomeCard } from "@/modules/survey/editor/components/edit-welcome-card";
import { HiddenFieldsCard } from "@/modules/survey/editor/components/hidden-fields-card";
import { QuestionsDroppable } from "@/modules/survey/editor/components/questions-droppable";
import { SurveyVariablesCard } from "@/modules/survey/editor/components/survey-variables-card";
import {
  addBlock,
  deleteBlock,
  duplicateBlock,
  moveBlock,
  updateElementInBlock,
} from "@/modules/survey/editor/lib/blocks";
import { findQuestionUsedInLogic, isUsedInQuota, isUsedInRecall } from "@/modules/survey/editor/lib/utils";
import {
  isEndingCardValid,
  isWelcomeCardValid,
  validateQuestion,
  validateSurveyQuestionsInBatch,
} from "../lib/validation";

interface QuestionsViewProps {
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<SetStateAction<TSurvey>>;
  activeQuestionId: TSurveyQuestionId | null;
  setActiveQuestionId: (questionId: TSurveyQuestionId | null) => void;
  project: Project;
  projectLanguages: Language[];
  invalidQuestions: string[] | null;
  setInvalidQuestions: React.Dispatch<SetStateAction<string[] | null>>;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (languageCode: string) => void;
  isMultiLanguageAllowed?: boolean;
  isFormbricksCloud: boolean;
  isCxMode: boolean;
  locale: TUserLocale;
  responseCount: number;
  setIsCautionDialogOpen: (open: boolean) => void;
  isStorageConfigured: boolean;
  quotas: TSurveyQuota[];
  isExternalUrlsAllowed: boolean;
}

export const QuestionsView = ({
  activeQuestionId,
  setActiveQuestionId,
  localSurvey,
  setLocalSurvey,
  project,
  projectLanguages,
  invalidQuestions,
  setInvalidQuestions,
  setSelectedLanguageCode,
  selectedLanguageCode,
  isMultiLanguageAllowed,
  isFormbricksCloud,
  isCxMode,
  locale,
  responseCount,
  setIsCautionDialogOpen,
  isStorageConfigured = true,
  quotas,
  isExternalUrlsAllowed,
}: QuestionsViewProps) => {
  const { t } = useTranslation();

  // Derive questions from blocks for display
  const questions = useMemo(() => {
    return localSurvey.blocks.flatMap((block) => block.elements);
  }, [localSurvey.blocks]);

  const internalQuestionIdMap = useMemo(() => {
    return questions.reduce((acc, question) => {
      acc[question.id] = createId();
      return acc;
    }, {});
  }, [questions]);

  const surveyLanguages = localSurvey.languages;

  const findElementLocation = (elementId: string) => {
    const blocks = localSurvey.blocks;

    for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
      const block = blocks[blockIndex];
      const elementIndex = block.elements.findIndex((e) => e.id === elementId);
      if (elementIndex !== -1) {
        return { blockId: block.id, blockIndex, elementIndex };
      }
    }

    return { blockId: null, blockIndex: -1, elementIndex: -1 };
  };

  const getQuestionIdFromBlockId = (block: TSurveyBlock): string => block.elements[0].id;

  const getBlockName = (index: number): string => {
    return `Block ${index + 1}`;
  };

  const handleQuestionLogicChange = (survey: TSurvey, compareId: string, updatedId: string): TSurvey => {
    const updateConditions = (conditions: TConditionGroup): TConditionGroup => {
      return {
        ...conditions,
        conditions: conditions?.conditions.map((condition) => {
          if (isConditionGroup(condition)) {
            return updateConditions(condition);
          } else {
            return updateSingleCondition(condition);
          }
        }),
      };
    };

    const updateSingleCondition = (condition: TSingleCondition): TSingleCondition => {
      let updatedCondition = { ...condition };

      if (condition.leftOperand.value === compareId) {
        updatedCondition.leftOperand = { ...condition.leftOperand, value: updatedId };
      }

      if (condition.rightOperand?.type === "question" && condition.rightOperand?.value === compareId) {
        updatedCondition.rightOperand = { ...condition.rightOperand, value: updatedId };
      }

      return updatedCondition;
    };

    const updateActions = (actions: TSurveyBlockLogicAction[]): TSurveyBlockLogicAction[] => {
      return actions.map((action) => {
        let updatedAction = { ...action };

        // Handle jumpToBlock actions (blocks model)
        if (updatedAction.objective === "jumpToBlock" && updatedAction.target === compareId) {
          updatedAction.target = updatedId;
        }

        if (updatedAction.objective === "requireAnswer" && updatedAction.target === compareId) {
          updatedAction.target = updatedId;
        }

        return updatedAction;
      });
    };

    const updatedBlocks = survey.blocks.map((block) => {
      const updatedElements = block.elements.map((element) => {
        let updatedElement = { ...element };

        if (element.headline[selectedLanguageCode]?.includes(`recall:${compareId}`)) {
          updatedElement.headline = {
            ...element.headline,
            [selectedLanguageCode]: element.headline[selectedLanguageCode].replaceAll(
              `recall:${compareId}`,
              `recall:${updatedId}`
            ),
          };
        }

        return updatedElement;
      });

      // Update block-level logic
      let updatedLogic = block.logic;
      if (block.logic) {
        updatedLogic = block.logic.map((logicRule: TSurveyBlockLogic) => ({
          ...logicRule,
          conditions: updateConditions(logicRule.conditions),
          actions: updateActions(logicRule.actions),
        }));
      }

      return {
        ...block,
        elements: updatedElements,
        logic: updatedLogic,
      };
    });

    return {
      ...survey,
      blocks: updatedBlocks,
    };
  };

  useEffect(() => {
    if (!invalidQuestions) return;
    let updatedInvalidQuestions: string[] = invalidQuestions;

    // Check welcome card
    if (localSurvey.welcomeCard.enabled && !isWelcomeCardValid(localSurvey.welcomeCard, surveyLanguages)) {
      if (!updatedInvalidQuestions.includes("start")) {
        updatedInvalidQuestions.push("start");
      }
    } else {
      updatedInvalidQuestions = updatedInvalidQuestions.filter((questionId) => questionId !== "start");
    }

    // Check thank you card
    localSurvey.endings.forEach((ending) => {
      if (!isEndingCardValid(ending, surveyLanguages)) {
        if (!updatedInvalidQuestions.includes(ending.id)) {
          updatedInvalidQuestions.push(ending.id);
        }
      } else {
        updatedInvalidQuestions = updatedInvalidQuestions.filter((questionId) => questionId !== ending.id);
      }
    });

    if (JSON.stringify(updatedInvalidQuestions) !== JSON.stringify(invalidQuestions)) {
      setInvalidQuestions(updatedInvalidQuestions);
    }
  }, [localSurvey.welcomeCard, localSurvey.endings, surveyLanguages, invalidQuestions, setInvalidQuestions]);

  // function to validate individual questions
  const validateSurveyQuestion = (question: TSurveyQuestion) => {
    // prevent this function to execute further if user hasnt still tried to save the survey
    if (invalidQuestions === null) {
      return;
    }

    const firstElement = localSurvey.blocks?.[0]?.elements[0];
    const isFirstQuestion = firstElement ? question.id === firstElement.id : false;

    if (validateQuestion(question as unknown as TSurveyQuestion, surveyLanguages, isFirstQuestion)) {
      const blocksWithCyclicLogic = findBlocksWithCyclicLogic(localSurvey.blocks);

      for (const blockId of blocksWithCyclicLogic) {
        const block = localSurvey.blocks.find((b) => b.id === blockId);
        if (block) {
          const questionId = getQuestionIdFromBlockId(block);
          if (questionId === question.id) {
            setInvalidQuestions([...invalidQuestions, question.id]);
            return;
          }
        }
      }

      setInvalidQuestions(invalidQuestions.filter((id) => id !== question.id));
      return;
    }

    setInvalidQuestions([...invalidQuestions, question.id]);
    return;
  };

  const updateQuestion = (questionIdx: number, updatedAttributes: any) => {
    const question = questions[questionIdx];
    if (!question) return;

    const { blockId, blockIndex } = findElementLocation(question.id);
    if (!blockId || blockIndex === -1) return;

    let updatedSurvey = { ...localSurvey };

    // Handle block-level attributes (logic, logicFallback, buttonLabel, backButtonLabel) separately
    const blockLevelAttributes: any = {};
    const elementLevelAttributes: any = {};

    Object.keys(updatedAttributes).forEach((key) => {
      if (key === "logic" || key === "logicFallback" || key === "buttonLabel" || key === "backButtonLabel") {
        blockLevelAttributes[key] = updatedAttributes[key];
      } else {
        elementLevelAttributes[key] = updatedAttributes[key];
      }
    });

    // Update block-level attributes if any
    if (Object.keys(blockLevelAttributes).length > 0) {
      const blocks = [...(updatedSurvey.blocks ?? [])];
      blocks[blockIndex] = {
        ...blocks[blockIndex],
        ...blockLevelAttributes,
      };
      updatedSurvey = { ...updatedSurvey, blocks };
    }

    // Handle element ID changes
    if ("id" in elementLevelAttributes) {
      // if the survey question whose id is to be changed is linked to logic of any other survey then changing it
      const initialQuestionId = question.id;
      updatedSurvey = handleQuestionLogicChange(updatedSurvey, initialQuestionId, elementLevelAttributes.id);
      if (invalidQuestions?.includes(initialQuestionId)) {
        setInvalidQuestions(
          invalidQuestions.map((id) => (id === initialQuestionId ? elementLevelAttributes.id : id))
        );
      }

      // relink the question to internal Id
      internalQuestionIdMap[elementLevelAttributes.id] = internalQuestionIdMap[question.id];
      delete internalQuestionIdMap[question.id];
      setActiveQuestionId(elementLevelAttributes.id);
    }

    // Update element-level attributes if any
    if (Object.keys(elementLevelAttributes).length > 0) {
      const attributesToCheck = ["upperLabel", "lowerLabel"];

      // If the value of upperLabel or lowerLabel is equal to {default:""}, then delete the key
      const cleanedAttributes = { ...elementLevelAttributes };
      attributesToCheck.forEach((attribute) => {
        if (Object.keys(cleanedAttributes).includes(attribute)) {
          const currentLabel = cleanedAttributes[attribute];
          if (
            currentLabel &&
            Object.keys(currentLabel).length === 1 &&
            currentLabel["default"].trim() === ""
          ) {
            delete cleanedAttributes[attribute];
          }
        }
      });

      const result = updateElementInBlock(updatedSurvey, blockId, question.id, cleanedAttributes);

      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }

      updatedSurvey = result.data;

      // Validate the updated question
      const updatedQuestion = updatedSurvey.blocks
        ?.flatMap((b) => b.elements)
        .find((q) => q.id === (cleanedAttributes.id ?? question.id));
      if (updatedQuestion) {
        validateSurveyQuestion(updatedQuestion as unknown as TSurveyQuestion);
      }
    }

    setLocalSurvey(updatedSurvey);
  };

  // Update block logic (block-level property)
  const updateBlockLogic = (questionIdx: number, logic: TSurveyBlockLogic[]) => {
    const question = questions[questionIdx];
    if (!question) return;

    const { blockIndex } = findElementLocation(question.id);
    if (blockIndex === -1) return;

    const blocks = [...(localSurvey.blocks ?? [])];
    blocks[blockIndex] = {
      ...blocks[blockIndex],
      logic,
    };

    setLocalSurvey({ ...localSurvey, blocks });
  };

  // Update block logic fallback (block-level property)
  const updateBlockLogicFallback = (questionIdx: number, logicFallback: string | undefined) => {
    const question = questions[questionIdx];
    if (!question) return;

    const { blockIndex } = findElementLocation(question.id);
    if (blockIndex === -1) return;

    const blocks = [...(localSurvey.blocks ?? [])];
    blocks[blockIndex] = {
      ...blocks[blockIndex],
      logicFallback,
    };

    setLocalSurvey({ ...localSurvey, blocks });
  };

  // Update block button label (block-level property)
  const updateBlockButtonLabel = (
    blockIndex: number,
    labelKey: "buttonLabel" | "backButtonLabel",
    labelValue: TI18nString | undefined
  ) => {
    const blocks = [...(localSurvey.blocks ?? [])];
    blocks[blockIndex] = {
      ...blocks[blockIndex],
      [labelKey]: labelValue,
    };
    setLocalSurvey({ ...localSurvey, blocks });
  };

  const deleteQuestion = (questionIdx: number) => {
    const question = questions[questionIdx];
    if (!question) return;

    const questionId = question.id;
    const activeQuestionIdTemp = activeQuestionId ?? questions[0]?.id;
    let updatedSurvey: TSurvey = { ...localSurvey };

    // checking if this question is used in logic of any other question
    const quesIdx = findQuestionUsedInLogic(localSurvey, questionId);
    if (quesIdx !== -1) {
      toast.error(t("environments.surveys.edit.question_used_in_logic", { questionIndex: quesIdx + 1 }));
      return;
    }

    const recallQuestionIdx = isUsedInRecall(localSurvey, questionId);
    if (recallQuestionIdx === questions.length) {
      toast.error(t("environments.surveys.edit.question_used_in_recall_ending_card"));
      return;
    }
    if (recallQuestionIdx !== -1) {
      toast.error(
        t("environments.surveys.edit.question_used_in_recall", { questionIndex: recallQuestionIdx + 1 })
      );
      return;
    }

    const quotaIdx = quotas.findIndex((quota) => isUsedInQuota(quota, { questionId }));
    if (quotaIdx !== -1) {
      toast.error(
        t("environments.surveys.edit.question_used_in_quota", {
          questionIndex: questionIdx + 1,
          quotaName: quotas[quotaIdx].name,
        })
      );
      return;
    }

    // check if we are recalling from this question for every language
    updatedSurvey.blocks = (updatedSurvey.blocks ?? []).map((block) => ({
      ...block,
      elements: block.elements.map((element) => {
        const updatedElement = { ...element };
        for (const [languageCode, headline] of Object.entries(element.headline)) {
          if (headline.includes(`recall:${questionId}`)) {
            const recallInfo = extractRecallInfo(headline);
            if (recallInfo) {
              updatedElement.headline = {
                ...updatedElement.headline,
                [languageCode]: headline.replace(recallInfo, ""),
              };
            }
          }
        }
        return updatedElement;
      }),
    }));

    // Find and delete the block containing this question
    const { blockId } = findElementLocation(questionId);
    if (!blockId) return;

    const result = deleteBlock(updatedSurvey, blockId);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }

    const firstEndingCard = localSurvey.endings[0];
    setLocalSurvey(result.data);
    delete internalQuestionIdMap[questionId];

    if (questionId === activeQuestionIdTemp) {
      const newQuestions = result.data.blocks?.flatMap((b) => b.elements) ?? [];
      if (questionIdx <= newQuestions.length && newQuestions.length > 0) {
        setActiveQuestionId(newQuestions[questionIdx % newQuestions.length].id);
      } else if (firstEndingCard) {
        setActiveQuestionId(firstEndingCard.id);
      }
    }

    toast.success(t("environments.surveys.edit.question_deleted"));
  };

  const duplicateQuestion = (questionIdx: number) => {
    const question = questions[questionIdx];
    if (!question) return;

    const { blockId } = findElementLocation(question.id);
    if (!blockId) return;

    const result = duplicateBlock(localSurvey, blockId);

    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }

    // The duplicated block has new element IDs, find the first one
    const allBlocks = result.data.blocks ?? [];
    const { blockIndex } = findElementLocation(question.id);
    const duplicatedBlock = allBlocks[blockIndex + 1];
    const newElementId = duplicatedBlock?.elements[0]?.id;

    if (newElementId) {
      setActiveQuestionId(newElementId);
      internalQuestionIdMap[newElementId] = createId();
    }

    setLocalSurvey(result.data);
    toast.success(t("environments.surveys.edit.question_duplicated"));
  };

  const addQuestion = (question: TSurveyQuestion, index?: number) => {
    const languageSymbols = extractLanguageCodes(localSurvey.languages);
    const updatedQuestion = addMultiLanguageLabels(question, languageSymbols);

    const blockName = getBlockName(index ?? questions.length);
    const newBlock = {
      name: blockName,
      elements: [{ ...updatedQuestion, isDraft: true }],
    };

    const result = addBlock(t, localSurvey, newBlock, index);

    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }

    setLocalSurvey(result.data);
    setActiveQuestionId(question.id);
    internalQuestionIdMap[question.id] = createId();
  };

  const addEndingCard = (index: number) => {
    const updatedSurvey = structuredClone(localSurvey);
    const newEndingCard = getDefaultEndingCard(localSurvey.languages, t);

    updatedSurvey.endings.splice(index, 0, newEndingCard);
    setActiveQuestionId(newEndingCard.id);

    setLocalSurvey(updatedSurvey);
  };

  const moveQuestion = (questionIndex: number, up: boolean) => {
    const question = questions[questionIndex];
    if (!question) return;

    const { blockId } = findElementLocation(question.id);
    if (!blockId) return;

    const direction = up ? "up" : "down";
    const result = moveBlock(localSurvey, blockId, direction);

    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }

    setLocalSurvey(result.data);
  };

  //useEffect to validate survey when changes are made to languages
  useEffect(() => {
    if (!invalidQuestions) return;
    let updatedInvalidQuestions: string[] = invalidQuestions;
    // Validate each question
    questions.forEach((question, index) => {
      updatedInvalidQuestions = validateSurveyQuestionsInBatch(
        question as unknown as TSurveyQuestion,
        updatedInvalidQuestions,
        surveyLanguages,
        index === 0
      );
    });

    if (JSON.stringify(updatedInvalidQuestions) !== JSON.stringify(invalidQuestions)) {
      setInvalidQuestions(updatedInvalidQuestions);
    }
  }, [questions, surveyLanguages, invalidQuestions, setInvalidQuestions]);

  useEffect(() => {
    const questionWithEmptyFallback = checkForEmptyFallBackValue(localSurvey, selectedLanguageCode);
    if (questionWithEmptyFallback) {
      setActiveQuestionId(questionWithEmptyFallback.id);
      if (activeQuestionId === questionWithEmptyFallback.id) {
        toast.error(t("environments.surveys.edit.fallback_missing"));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQuestionId, setActiveQuestionId]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const onQuestionCardDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    // Find source and destination block indices
    const sourceQuestion = questions.find((q) => q.id === active.id);
    const destQuestion = questions.find((q) => q.id === over?.id);

    if (!sourceQuestion || !destQuestion) return;

    const { blockIndex: sourceBlockIndex } = findElementLocation(sourceQuestion.id);
    const { blockIndex: destBlockIndex } = findElementLocation(destQuestion.id);

    if (sourceBlockIndex === -1 || destBlockIndex === -1) return;
    if (sourceBlockIndex === destBlockIndex) return; // No move needed

    // Reorder blocks
    const blocks = [...(localSurvey.blocks ?? [])];
    const [movedBlock] = blocks.splice(sourceBlockIndex, 1);
    blocks.splice(destBlockIndex, 0, movedBlock);

    setLocalSurvey({ ...localSurvey, blocks });
  };

  const onEndingCardDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const newEndings = Array.from(localSurvey.endings);
    const sourceIndex = newEndings.findIndex((ending) => ending.id === active.id);
    const destinationIndex = newEndings.findIndex((ending) => ending.id === over?.id);
    const [reorderedEndings] = newEndings.splice(sourceIndex, 1);
    newEndings.splice(destinationIndex, 0, reorderedEndings);
    const updatedSurvey = { ...localSurvey, endings: newEndings };
    setLocalSurvey(updatedSurvey);
  };

  // Auto animate
  const [parent] = useAutoAnimate();

  return (
    <div className="mt-12 w-full px-5 py-4">
      {!isCxMode && (
        <div className="mb-5 flex w-full flex-col gap-5">
          <EditWelcomeCard
            localSurvey={localSurvey}
            setLocalSurvey={setLocalSurvey}
            setActiveQuestionId={setActiveQuestionId}
            activeQuestionId={activeQuestionId}
            isInvalid={invalidQuestions ? invalidQuestions.includes("start") : false}
            setSelectedLanguageCode={setSelectedLanguageCode}
            selectedLanguageCode={selectedLanguageCode}
            locale={locale}
            isStorageConfigured={isStorageConfigured}
          />
        </div>
      )}

      <DndContext
        id="questions"
        sensors={sensors}
        onDragEnd={onQuestionCardDragEnd}
        collisionDetection={closestCorners}>
        <QuestionsDroppable
          localSurvey={localSurvey}
          project={project}
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
          invalidQuestions={invalidQuestions}
          addQuestion={addQuestion}
          isFormbricksCloud={isFormbricksCloud}
          isCxMode={isCxMode}
          locale={locale}
          responseCount={responseCount}
          onAlertTrigger={() => setIsCautionDialogOpen(true)}
          isStorageConfigured={isStorageConfigured}
          isExternalUrlsAllowed={isExternalUrlsAllowed}
        />
      </DndContext>

      <AddQuestionButton addQuestion={addQuestion} project={project} isCxMode={isCxMode} />
      <div className="mt-5 flex flex-col gap-5" ref={parent}>
        <hr className="border-t border-dashed" />
        <DndContext
          id="endings"
          sensors={sensors}
          onDragEnd={onEndingCardDragEnd}
          collisionDetection={closestCorners}>
          <SortableContext items={localSurvey.endings} strategy={verticalListSortingStrategy}>
            {localSurvey.endings.map((ending, index) => {
              return (
                <EditEndingCard
                  key={ending.id}
                  localSurvey={localSurvey}
                  endingCardIndex={index}
                  setLocalSurvey={setLocalSurvey}
                  setActiveQuestionId={setActiveQuestionId}
                  activeQuestionId={activeQuestionId}
                  isInvalid={invalidQuestions ? invalidQuestions.includes(ending.id) : false}
                  setSelectedLanguageCode={setSelectedLanguageCode}
                  selectedLanguageCode={selectedLanguageCode}
                  addEndingCard={addEndingCard}
                  isFormbricksCloud={isFormbricksCloud}
                  locale={locale}
                  isStorageConfigured={isStorageConfigured}
                  quotas={quotas}
                  isExternalUrlsAllowed={isExternalUrlsAllowed}
                />
              );
            })}
          </SortableContext>
        </DndContext>

        {!isCxMode && (
          <>
            <AddEndingCardButton localSurvey={localSurvey} addEndingCard={addEndingCard} />
            <hr />

            <HiddenFieldsCard
              localSurvey={localSurvey}
              setLocalSurvey={setLocalSurvey}
              setActiveQuestionId={setActiveQuestionId}
              activeQuestionId={activeQuestionId}
              quotas={quotas}
            />

            <SurveyVariablesCard
              localSurvey={localSurvey}
              setLocalSurvey={setLocalSurvey}
              activeQuestionId={activeQuestionId}
              setActiveQuestionId={setActiveQuestionId}
              quotas={quotas}
            />

            <MultiLanguageCard
              localSurvey={localSurvey}
              projectLanguages={projectLanguages}
              setLocalSurvey={setLocalSurvey}
              setActiveQuestionId={setActiveQuestionId}
              activeQuestionId={activeQuestionId}
              isMultiLanguageAllowed={isMultiLanguageAllowed}
              isFormbricksCloud={isFormbricksCloud}
              setSelectedLanguageCode={setSelectedLanguageCode}
              locale={locale}
            />
          </>
        )}
      </div>
    </div>
  );
};
