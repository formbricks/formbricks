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
import { TSurveyElement } from "@formbricks/types/surveys/elements";
import { type TConditionGroup, type TSingleCondition } from "@formbricks/types/surveys/logic";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { getDefaultEndingCard } from "@/app/lib/survey-builder";
import { addMultiLanguageLabels, createI18nString, extractLanguageCodes } from "@/lib/i18n/utils";
import { structuredClone } from "@/lib/pollyfills/structuredClone";
import { isConditionGroup } from "@/lib/surveyLogic/utils";
import { checkForEmptyFallBackValue } from "@/lib/utils/recall";
import { MultiLanguageCard } from "@/modules/ee/multi-language-surveys/components/multi-language-card";
import { AddElementButton } from "@/modules/survey/editor/components/add-element-button";
import { AddEndingCardButton } from "@/modules/survey/editor/components/add-ending-card-button";
import { BlocksDroppable } from "@/modules/survey/editor/components/blocks-droppable";
import { EditEndingCard } from "@/modules/survey/editor/components/edit-ending-card";
import { EditWelcomeCard } from "@/modules/survey/editor/components/edit-welcome-card";
import { HiddenFieldsCard } from "@/modules/survey/editor/components/hidden-fields-card";
import { SurveyVariablesCard } from "@/modules/survey/editor/components/survey-variables-card";
import {
  addElementToBlock,
  deleteBlock,
  deleteElementFromBlock,
  duplicateBlock as duplicateBlockHelper,
  findElementLocation,
  moveBlock as moveBlockHelper,
  moveElementInBlock,
  renumberBlocks,
  updateElementInBlock,
} from "@/modules/survey/editor/lib/blocks";
import { findElementUsedInLogic, isUsedInQuota, isUsedInRecall } from "@/modules/survey/editor/lib/utils";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import { isEndingCardValid, isWelcomeCardValid, validateSurveyElementsInBatch } from "../lib/validation";

interface ElementsViewProps {
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<SetStateAction<TSurvey>>;
  activeElementId: string | null;
  setActiveElementId: (elementId: string | null) => void;
  project: Project;
  projectLanguages: Language[];
  invalidElements: string[] | null;
  setInvalidElements: React.Dispatch<SetStateAction<string[] | null>>;
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

export const ElementsView = ({
  activeElementId,
  setActiveElementId,
  localSurvey,
  setLocalSurvey,
  project,
  projectLanguages,
  invalidElements,
  setInvalidElements,
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
}: ElementsViewProps) => {
  const { t } = useTranslation();

  const elements = useMemo(() => getElementsFromBlocks(localSurvey.blocks), [localSurvey.blocks]);

  const internalElementIdMap = useMemo(() => {
    return elements.reduce((acc, element) => {
      acc[element.id] = createId();
      return acc;
    }, {});
  }, [elements]);

  const surveyLanguages = localSurvey.languages;

  const getBlockName = (index: number): string => {
    return `Block ${index + 1}`;
  };

  const handleElementLogicChange = (survey: TSurvey, compareId: string, updatedId: string): TSurvey => {
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

      if (condition.rightOperand?.type === "element" && condition.rightOperand?.value === compareId) {
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
    if (!invalidElements) return;
    let updatedInvalidElements: string[] = [...invalidElements];

    // Check welcome card
    if (localSurvey.welcomeCard.enabled && !isWelcomeCardValid(localSurvey.welcomeCard, surveyLanguages)) {
      if (!updatedInvalidElements.includes("start")) {
        updatedInvalidElements = [...updatedInvalidElements, "start"];
      }
    } else {
      updatedInvalidElements = updatedInvalidElements.filter((elementId) => elementId !== "start");
    }

    // Check thank you card
    localSurvey.endings.forEach((ending) => {
      if (!isEndingCardValid(ending, surveyLanguages)) {
        if (!updatedInvalidElements.includes(ending.id)) {
          updatedInvalidElements = [...updatedInvalidElements, ending.id];
        }
      } else {
        updatedInvalidElements = updatedInvalidElements.filter((elementId) => elementId !== ending.id);
      }
    });

    if (JSON.stringify(updatedInvalidElements) !== JSON.stringify(invalidElements)) {
      setInvalidElements(updatedInvalidElements);
    }
  }, [localSurvey.welcomeCard, localSurvey.endings, surveyLanguages, invalidElements, setInvalidElements]);

  const updateElement = (elementIdx: number, updatedAttributes: any) => {
    // Get element ID from current elements array (for validation)
    const element = elements[elementIdx];
    if (!element) return;

    // Store element ID for use in functional updater
    const elementId = element.id;

    // Track side effects that need to happen after state update
    let newActiveElementId: string | null = null;
    let invalidElementsUpdate: string[] | null = null;

    // Use functional update to ensure we work with the latest state
    setLocalSurvey((prevSurvey) => {
      // Re-find element location in the CURRENT state to avoid stale data
      const { blockId, blockIndex } = findElementLocation(prevSurvey, elementId);

      // If element no longer exists in survey (e.g., block was deleted), don't update
      if (!blockId || blockIndex === -1) {
        return prevSurvey;
      }

      let updatedSurvey = { ...prevSurvey };

      // Handle block-level attributes (logic, logicFallback, buttonLabel, backButtonLabel) separately
      const blockLevelAttributes: any = {};
      const elementLevelAttributes: any = {};

      Object.keys(updatedAttributes).forEach((key) => {
        if (
          key === "logic" ||
          key === "logicFallback" ||
          key === "buttonLabel" ||
          key === "backButtonLabel"
        ) {
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
        const initialElementId = elementId;
        updatedSurvey = handleElementLogicChange(updatedSurvey, initialElementId, elementLevelAttributes.id);

        // Track side effects to apply after state update
        if (invalidElements?.includes(initialElementId)) {
          invalidElementsUpdate = invalidElements.map((id) =>
            id === initialElementId ? elementLevelAttributes.id : id
          );
        }

        // Track new active element ID
        newActiveElementId = elementLevelAttributes.id;

        // Update internal element ID map
        internalElementIdMap[elementLevelAttributes.id] = internalElementIdMap[elementId];
        delete internalElementIdMap[elementId];
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

        const result = updateElementInBlock(updatedSurvey, blockId, elementId, cleanedAttributes);

        if (!result.ok) {
          // Can't show toast inside functional updater, return unchanged
          return prevSurvey;
        }

        updatedSurvey = result.data;
      }

      return updatedSurvey;
    });

    // Apply side effects after state update is queued
    if (invalidElementsUpdate) {
      setInvalidElements(invalidElementsUpdate);
    }
    if (newActiveElementId) {
      setActiveElementId(newActiveElementId);
    }
  };

  // Update block logic (block-level property)
  const updateBlockLogic = (blockIdx: number, logic: TSurveyBlockLogic[]) => {
    if (blockIdx < 0 || blockIdx >= localSurvey.blocks.length) return;

    setLocalSurvey((prevSurvey) => {
      const blocks = [...(prevSurvey.blocks ?? [])];
      blocks[blockIdx] = {
        ...blocks[blockIdx],
        logic,
      };
      return { ...prevSurvey, blocks };
    });
  };

  // Update block logic fallback (block-level property)
  const updateBlockLogicFallback = (blockIdx: number, logicFallback: string | undefined) => {
    if (blockIdx < 0 || blockIdx >= localSurvey.blocks.length) return;

    setLocalSurvey((prevSurvey) => {
      const blocks = [...(prevSurvey.blocks ?? [])];
      blocks[blockIdx] = {
        ...blocks[blockIdx],
        logicFallback,
      };
      return { ...prevSurvey, blocks };
    });
  };

  // Update block button label (block-level property)
  const updateBlockButtonLabel = (
    blockIndex: number,
    labelKey: "buttonLabel" | "backButtonLabel",
    labelValue: TI18nString | undefined
  ) => {
    setLocalSurvey((prevSurvey) => {
      const blocks = [...(prevSurvey.blocks ?? [])];

      // Bounds check
      if (blockIndex < 0 || blockIndex >= blocks.length) {
        return prevSurvey;
      }

      blocks[blockIndex] = {
        ...blocks[blockIndex],
        [labelKey]: labelValue,
      };

      return { ...prevSurvey, blocks };
    });
  };

  const validateElementDeletion = (elementId: string, elementIdx: number): boolean => {
    const usedElementIdx = findElementUsedInLogic(localSurvey, elementId);
    if (usedElementIdx !== -1) {
      toast.error(
        t("environments.surveys.edit.question_used_in_logic", { questionIndex: usedElementIdx + 1 })
      );
      return false;
    }

    const recallElementIdx = isUsedInRecall(localSurvey, elementId);
    if (recallElementIdx === elements.length) {
      toast.error(t("environments.surveys.edit.question_used_in_recall_ending_card"));
      return false;
    }
    if (recallElementIdx !== -1) {
      toast.error(
        t("environments.surveys.edit.question_used_in_recall", { questionIndex: recallElementIdx + 1 })
      );
      return false;
    }

    const quotaIdx = quotas.findIndex((quota) => isUsedInQuota(quota, { elementId: elementId }));
    if (quotaIdx !== -1) {
      toast.error(
        t("environments.surveys.edit.question_used_in_quota", {
          questionIndex: elementIdx + 1,
          quotaName: quotas[quotaIdx].name,
        })
      );
      return false;
    }

    return true;
  };

  const handleActiveElementAfterDeletion = (
    elementId: string,
    elementIdx: number,
    updatedSurvey: TSurvey,
    activeElementIdTemp: string
  ) => {
    if (elementId === activeElementIdTemp) {
      const newElements = updatedSurvey.blocks.flatMap((b) => b.elements) ?? [];
      const firstEndingCard = localSurvey.endings[0];
      if (elementIdx <= newElements.length && newElements.length > 0) {
        setActiveElementId(newElements[elementIdx % newElements.length].id);
      } else if (firstEndingCard) {
        setActiveElementId(firstEndingCard.id);
      }
    }
  };

  const deleteElement = (elementIdx: number) => {
    const element = elements[elementIdx];
    if (!element) return;

    const elementId = element.id;
    if (!validateElementDeletion(elementId, elementIdx)) {
      return;
    }

    const activeElementIdTemp = activeElementId ?? elements[0]?.id;
    // let updatedSurvey = removeRecallReferences(localSurvey, elementId);
    let updatedSurvey = structuredClone(localSurvey);

    const { blockId, blockIndex } = findElementLocation(localSurvey, elementId);
    if (!blockId || blockIndex === -1) return;

    const block = updatedSurvey.blocks[blockIndex];
    const result =
      block.elements.length === 1
        ? deleteBlock(updatedSurvey, blockId)
        : deleteElementFromBlock(updatedSurvey, blockId, elementId);

    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }

    updatedSurvey = result.data;
    setLocalSurvey(updatedSurvey);
    delete internalElementIdMap[elementId];

    handleActiveElementAfterDeletion(elementId, elementIdx, updatedSurvey, activeElementIdTemp);

    toast.success(t("environments.surveys.edit.question_deleted"));
  };

  const duplicateElement = (elementIdx: number) => {
    const element = elements[elementIdx];
    if (!element) return;

    const { blockId, blockIndex } = findElementLocation(localSurvey, element.id);
    if (!blockId || blockIndex === -1) return;

    // Create a duplicate of the element with a new ID
    const newElementId = createId();
    const duplicatedElement = { ...element, id: newElementId };

    // Add the duplicated element to the same block
    const result = addElementToBlock(localSurvey, blockId, duplicatedElement);

    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }

    setActiveElementId(newElementId);
    internalElementIdMap[newElementId] = createId();

    setLocalSurvey(result.data);
    toast.success(t("environments.surveys.edit.question_duplicated"));
  };

  const addElement = (element: TSurveyElement, index?: number) => {
    // Use functional update to ensure we work with the latest state
    const newBlockId = createId();

    setLocalSurvey((prevSurvey) => {
      const languageSymbols = extractLanguageCodes(prevSurvey.languages);
      const updatedElement = addMultiLanguageLabels(element, languageSymbols);

      const newBlock = {
        id: newBlockId,
        name: getBlockName(index ?? prevSurvey.blocks.length),
        elements: [{ ...updatedElement, isDraft: true }],
        buttonLabel: createI18nString("", []),
        backButtonLabel: createI18nString("", []),
      };

      return {
        ...prevSurvey,
        blocks: [...prevSurvey.blocks, newBlock],
      };
    });

    setActiveElementId(element.id);
    internalElementIdMap[element.id] = createId();
  };

  const _addElementToBlock = (element: TSurveyElement, blockId: string, afterElementIdx: number) => {
    const languageSymbols = extractLanguageCodes(localSurvey.languages);
    const updatedElement = addMultiLanguageLabels(element, languageSymbols);

    const targetIndex = afterElementIdx + 1;
    const result = addElementToBlock(
      localSurvey,
      blockId,
      {
        ...updatedElement,
        isDraft: true,
      },
      targetIndex
    );

    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }

    setLocalSurvey(result.data);
    setActiveElementId(updatedElement.id);
    internalElementIdMap[updatedElement.id] = createId();
  };

  const moveElementToBlock = (elementId: string, targetBlockId: string) => {
    const updatedSurvey = structuredClone(localSurvey);

    // Find the source block and element
    let sourceBlock: TSurveyBlock | undefined;
    let elementToMove: TSurveyElement | undefined;
    let elementIndexInBlock = -1;

    for (const block of updatedSurvey.blocks) {
      const idx = block.elements.findIndex((el) => el.id === elementId);
      if (idx !== -1) {
        sourceBlock = block;
        elementToMove = block.elements[idx];
        elementIndexInBlock = idx;
        break;
      }
    }

    if (!sourceBlock || !elementToMove) {
      toast.error(t("environments.surveys.edit.element_not_found"));
      return;
    }

    // Remove element from source block
    sourceBlock.elements.splice(elementIndexInBlock, 1);

    // If source block is now empty, delete it
    if (sourceBlock.elements.length === 0) {
      const blockIdx = updatedSurvey.blocks.findIndex((b) => b.id === sourceBlock.id);
      if (blockIdx !== -1) {
        updatedSurvey.blocks.splice(blockIdx, 1);
      }
    }

    // Add element to target block at the end
    const targetBlock = updatedSurvey.blocks.find((b) => b.id === targetBlockId);
    if (!targetBlock) {
      toast.error(t("environments.surveys.edit.target_block_not_found"));
      return;
    }

    targetBlock.elements.push(elementToMove);

    setLocalSurvey(updatedSurvey);
    setActiveElementId(elementId);
  };

  const addEndingCard = (index: number) => {
    const updatedSurvey = structuredClone(localSurvey);
    const newEndingCard = getDefaultEndingCard(localSurvey.languages, t);

    updatedSurvey.endings.splice(index, 0, newEndingCard);
    setActiveElementId(newEndingCard.id);

    setLocalSurvey(updatedSurvey);
  };

  const moveElement = (elementIdx: number, up: boolean) => {
    const element = elements[elementIdx];
    if (!element) return;

    const { blockId, blockIndex } = findElementLocation(localSurvey, element.id);
    if (!blockId || blockIndex === -1) return;

    const block = localSurvey.blocks[blockIndex];
    const elementIndex = block.elements.findIndex((el) => el.id === element.id);

    // If block has multiple elements, move element within the block
    if (block.elements.length > 1) {
      // Check if we can move in the desired direction within the block
      if ((up && elementIndex > 0) || (!up && elementIndex < block.elements.length - 1)) {
        const direction = up ? "up" : "down";
        const result = moveElementInBlock(localSurvey, blockId, element.id, direction);

        if (!result.ok) {
          toast.error(result.error.message);
          return;
        }

        setLocalSurvey(result.data);
        return;
      }
      // If we can't move within block, fall through to move the entire block
    }

    // Move the entire block
    const direction = up ? "up" : "down";
    const result = moveBlockHelper(localSurvey, blockId, direction);

    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }

    setLocalSurvey(result.data);
  };

  // Block-level operations
  const duplicateBlock = (blockId: string) => {
    const result = duplicateBlockHelper(localSurvey, blockId);

    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }

    // Find the duplicated block and set the first element as active
    const blockIndex = localSurvey.blocks.findIndex((b) => b.id === blockId);
    if (blockIndex !== -1) {
      const duplicatedBlock = result.data.blocks[blockIndex + 1];
      if (duplicatedBlock?.elements[0]) {
        setActiveElementId(duplicatedBlock.elements[0].id);
        internalElementIdMap[duplicatedBlock.elements[0].id] = createId();
      }
    }

    setLocalSurvey(result.data);
    toast.success(t("environments.surveys.edit.block_duplicated"));
  };

  const deleteBlockById = (blockId: string) => {
    // First check if block exists in current state (for validation and calculating next active element)
    const blockExists = localSurvey.blocks.some((b) => b.id === blockId);
    if (!blockExists) {
      return;
    }

    // Prevent deleting the last block
    if (localSurvey.blocks.length === 1) {
      return;
    }

    // Calculate the new active element before deletion
    const remainingBlocks = localSurvey.blocks.filter((b) => b.id !== blockId);
    let newActiveElementId: string | null = null;
    if (remainingBlocks.length > 0 && remainingBlocks[0].elements.length > 0) {
      newActiveElementId = remainingBlocks[0].elements[0].id;
    } else if (localSurvey.endings[0]) {
      newActiveElementId = localSurvey.endings[0].id;
    }

    // Use functional update to ensure we work with the latest state
    setLocalSurvey((prevSurvey) => {
      const result = deleteBlock(prevSurvey, blockId);
      if (!result.ok) {
        // Return unchanged if block not found (shouldn't happen but be safe)
        return prevSurvey;
      }
      return result.data;
    });

    // Set active element after queuing the survey update
    if (newActiveElementId) {
      setActiveElementId(newActiveElementId);
    }
  };

  const moveBlockById = (blockId: string, direction: "up" | "down") => {
    const result = moveBlockHelper(localSurvey, blockId, direction);

    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }

    setLocalSurvey(result.data);
  };

  //useEffect to validate survey when changes are made to languages
  useEffect(() => {
    if (!invalidElements) return;
    let updatedInvalidElements: string[] = invalidElements;
    // Validate each element
    elements.forEach((element) => {
      updatedInvalidElements = validateSurveyElementsInBatch(
        element,
        updatedInvalidElements,
        surveyLanguages
      );
    });

    if (JSON.stringify(updatedInvalidElements) !== JSON.stringify(invalidElements)) {
      setInvalidElements(updatedInvalidElements);
    }
  }, [elements, surveyLanguages, invalidElements, setInvalidElements]);

  useEffect(() => {
    const elementWithEmptyFallback = checkForEmptyFallBackValue(localSurvey, selectedLanguageCode);
    if (elementWithEmptyFallback) {
      setActiveElementId(elementWithEmptyFallback.id);
      if (activeElementId === elementWithEmptyFallback.id) {
        toast.error(t("environments.surveys.edit.fallback_missing"));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeElementId, setActiveElementId]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const onBlockCardDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) return;

    const sourceBlockIndex = localSurvey.blocks.findIndex((b) => b.id === active.id);
    const destBlockIndex = localSurvey.blocks.findIndex((b) => b.id === over.id);

    if (sourceBlockIndex !== -1 && destBlockIndex !== -1) {
      // We're dragging blocks
      if (sourceBlockIndex === destBlockIndex) return; // No move needed

      const blocks = [...localSurvey.blocks];
      const [movedBlock] = blocks.splice(sourceBlockIndex, 1);
      blocks.splice(destBlockIndex, 0, movedBlock);

      // Renumber blocks sequentially after drag-and-drop reordering
      const renumberedBlocks = renumberBlocks(blocks);

      setLocalSurvey({ ...localSurvey, blocks: renumberedBlocks });
    }
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
            setActiveElementId={setActiveElementId}
            activeElementId={activeElementId}
            isInvalid={invalidElements ? invalidElements.includes("start") : false}
            setSelectedLanguageCode={setSelectedLanguageCode}
            selectedLanguageCode={selectedLanguageCode}
            locale={locale}
            isStorageConfigured={isStorageConfigured}
            isExternalUrlsAllowed={isExternalUrlsAllowed}
          />
        </div>
      )}

      <DndContext
        id="blocks"
        sensors={sensors}
        onDragEnd={onBlockCardDragEnd}
        collisionDetection={closestCorners}>
        <BlocksDroppable
          localSurvey={localSurvey}
          setLocalSurvey={setLocalSurvey}
          project={project}
          moveElement={moveElement}
          updateElement={updateElement}
          updateBlockLogic={updateBlockLogic}
          updateBlockLogicFallback={updateBlockLogicFallback}
          updateBlockButtonLabel={updateBlockButtonLabel}
          duplicateElement={duplicateElement}
          selectedLanguageCode={selectedLanguageCode}
          setSelectedLanguageCode={setSelectedLanguageCode}
          deleteElement={deleteElement}
          activeElementId={activeElementId}
          setActiveElementId={setActiveElementId}
          invalidElements={invalidElements}
          addElement={addElement}
          isFormbricksCloud={isFormbricksCloud}
          isCxMode={isCxMode}
          locale={locale}
          responseCount={responseCount}
          onAlertTrigger={() => setIsCautionDialogOpen(true)}
          isStorageConfigured={isStorageConfigured}
          isExternalUrlsAllowed={isExternalUrlsAllowed}
          duplicateBlock={duplicateBlock}
          deleteBlock={deleteBlockById}
          moveBlock={moveBlockById}
          addElementToBlock={_addElementToBlock}
          moveElementToBlock={moveElementToBlock}
        />
      </DndContext>

      <AddElementButton addElement={addElement} project={project} isCxMode={isCxMode} />
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
                  setActiveElementId={setActiveElementId}
                  activeElementId={activeElementId}
                  isInvalid={invalidElements ? invalidElements.includes(ending.id) : false}
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
              setActiveElementId={setActiveElementId}
              activeElementId={activeElementId}
              quotas={quotas}
            />

            <SurveyVariablesCard
              localSurvey={localSurvey}
              setLocalSurvey={setLocalSurvey}
              activeElementId={activeElementId}
              setActiveElementId={setActiveElementId}
              quotas={quotas}
            />

            <MultiLanguageCard
              localSurvey={localSurvey}
              projectLanguages={projectLanguages}
              setLocalSurvey={setLocalSurvey}
              setActiveElementId={setActiveElementId}
              activeElementId={activeElementId}
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
