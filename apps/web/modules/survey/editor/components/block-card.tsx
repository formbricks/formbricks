"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { Project } from "@prisma/client";
import * as Collapsible from "@radix-ui/react-collapsible";
import { ChevronDownIcon, ChevronRightIcon, GripIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TI18nString } from "@formbricks/types/i18n";
import { TSurveyBlock, TSurveyBlockLogic } from "@formbricks/types/surveys/blocks";
import { TSurveyElement, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { TUserLocale } from "@formbricks/types/user";
import { cn } from "@/lib/cn";
import { recallToHeadline } from "@/lib/utils/recall";
import { AddElementToBlockButton } from "@/modules/survey/editor/components/add-element-to-block-button";
import { AddressElementForm } from "@/modules/survey/editor/components/address-element-form";
import { AdvancedSettings } from "@/modules/survey/editor/components/advanced-settings";
import { BlockMenu } from "@/modules/survey/editor/components/block-menu";
import { BlockSettings } from "@/modules/survey/editor/components/block-settings";
import { CalElementForm } from "@/modules/survey/editor/components/cal-element-form";
import { ConsentElementForm } from "@/modules/survey/editor/components/consent-element-form";
import { ContactInfoElementForm } from "@/modules/survey/editor/components/contact-info-element-form";
import { CTAElementForm } from "@/modules/survey/editor/components/cta-element-form";
import { DateElementForm } from "@/modules/survey/editor/components/date-element-form";
import { EditorCardMenu } from "@/modules/survey/editor/components/editor-card-menu";
import { FileUploadElementForm } from "@/modules/survey/editor/components/file-upload-element-form";
import { MatrixElementForm } from "@/modules/survey/editor/components/matrix-element-form";
import { MultipleChoiceElementForm } from "@/modules/survey/editor/components/multiple-choice-element-form";
import { NPSElementForm } from "@/modules/survey/editor/components/nps-element-form";
import { OpenElementForm } from "@/modules/survey/editor/components/open-element-form";
import { PictureSelectionForm } from "@/modules/survey/editor/components/picture-selection-form";
import { RankingElementForm } from "@/modules/survey/editor/components/ranking-element-form";
import { RatingElementForm } from "@/modules/survey/editor/components/rating-element-form";
import { formatTextWithSlashes } from "@/modules/survey/editor/lib/utils";
import { isLabelValidForAllLanguages } from "@/modules/survey/editor/lib/validation";
import { getElementIconMap, getTSurveyElementTypeEnumName } from "@/modules/survey/lib/elements";
import { Alert, AlertButton, AlertTitle } from "@/modules/ui/components/alert";

interface BlockCardProps {
  localSurvey: TSurvey;
  project: Project;
  block: TSurveyBlock;
  blockIdx: number;
  moveElement: (elementIdx: number, up: boolean) => void;
  updateElement: (elementIdx: number, updatedAttributes: any) => void;
  updateBlockLogic: (elementIdx: number, logic: TSurveyBlockLogic[]) => void;
  updateBlockLogicFallback: (elementIdx: number, logicFallback: string | undefined) => void;
  updateBlockButtonLabel: (
    blockIndex: number,
    labelKey: "buttonLabel" | "backButtonLabel",
    labelValue: TI18nString | undefined
  ) => void;
  deleteElement: (elementIdx: number) => void;
  duplicateElement: (elementIdx: number) => void;
  activeElementId: string | null;
  setActiveElementId: (elementId: string | null) => void;
  lastElement: boolean;
  lastElementIndex: number;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (language: string) => void;
  invalidElements?: string[];
  addElement: (element: any, index?: number) => void;
  isFormbricksCloud: boolean;
  isCxMode: boolean;
  locale: TUserLocale;
  responseCount: number;
  onAlertTrigger: () => void;
  isStorageConfigured: boolean;
  isExternalUrlsAllowed: boolean;
  setLocalSurvey: (survey: TSurvey) => void;
  duplicateBlock: (blockId: string) => void;
  deleteBlock: (blockId: string) => void;
  moveBlock: (blockId: string, direction: "up" | "down") => void;
  addElementToBlock: (element: TSurveyElement, blockId: string, afterElementIdx: number) => void;
  moveElementToBlock?: (elementId: string, targetBlockId: string) => void;
  totalBlocks: number;
}

export const BlockCard = ({
  localSurvey,
  project,
  block,
  blockIdx,
  moveElement,
  updateElement,
  updateBlockLogic,
  updateBlockLogicFallback,
  updateBlockButtonLabel,
  duplicateElement,
  deleteElement,
  activeElementId,
  setActiveElementId,
  lastElement,
  lastElementIndex,
  selectedLanguageCode,
  setSelectedLanguageCode,
  invalidElements,
  addElement,
  isFormbricksCloud,
  isCxMode,
  locale,
  responseCount,
  onAlertTrigger,
  isStorageConfigured = true,
  isExternalUrlsAllowed,
  setLocalSurvey,
  duplicateBlock,
  deleteBlock,
  moveBlock,
  addElementToBlock,
  moveElementToBlock,
  totalBlocks,
}: BlockCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });
  const { t } = useTranslation();
  const ELEMENTS_ICON_MAP = getElementIconMap(t);

  const hasMultipleElements = block.elements.length > 1;
  const blockLogic = block.logic ?? [];

  // Check if any element in this block is currently active
  const isBlockOpen = block.elements.some((element) => element.id === activeElementId);

  const hasInvalidElement = block.elements.some((element) => invalidElements?.includes(element.id));

  // Check if button labels have incomplete translations for any enabled language
  // A button label is invalid if it exists but doesn't have valid text for all enabled languages
  const surveyLanguages = localSurvey.languages ?? [];
  const hasInvalidButtonLabel =
    block.buttonLabel !== undefined &&
    block.buttonLabel["default"]?.trim() !== "" &&
    !isLabelValidForAllLanguages(block.buttonLabel, surveyLanguages);

  // Check if back button label is invalid
  // Back button label should exist for all blocks except the first one
  const hasInvalidBackButtonLabel =
    blockIdx > 0 &&
    block.backButtonLabel !== undefined &&
    block.backButtonLabel["default"]?.trim() !== "" &&
    !isLabelValidForAllLanguages(block.backButtonLabel, surveyLanguages);

  // Block should be highlighted if it has invalid elements OR invalid button labels
  const isBlockInvalid = hasInvalidElement || hasInvalidButtonLabel || hasInvalidBackButtonLabel;

  const [isBlockCollapsed, setIsBlockCollapsed] = useState(false);
  const [openAdvanced, setOpenAdvanced] = useState(blockLogic.length > 0);

  const [parent] = useAutoAnimate();
  const [elementsParent] = useAutoAnimate();

  const getElementHeadline = (
    element: TSurveyElement,
    languageCode: string
  ): (string | React.ReactElement)[] | string | undefined => {
    const headlineData = recallToHeadline(element.headline, localSurvey, true, languageCode);
    const headlineText = headlineData[languageCode];
    if (headlineText) {
      return formatTextWithSlashes(getTextContent(headlineText ?? ""));
    }
    return getTSurveyElementTypeEnumName(element.type, t);
  };

  const shouldShowCautionAlert = (elementType: TSurveyElementTypeEnum): boolean => {
    return (
      responseCount > 0 &&
      [
        TSurveyElementTypeEnum.MultipleChoiceSingle,
        TSurveyElementTypeEnum.MultipleChoiceMulti,
        TSurveyElementTypeEnum.PictureSelection,
        TSurveyElementTypeEnum.Rating,
        TSurveyElementTypeEnum.NPS,
        TSurveyElementTypeEnum.Ranking,
        TSurveyElementTypeEnum.Matrix,
      ].includes(elementType)
    );
  };

  // Common props shared by all element forms
  const getCommonFormProps = (element: TSurveyElement, elementIdx: number) => ({
    localSurvey,
    element,
    elementIdx,
    updateElement,
    selectedLanguageCode,
    setSelectedLanguageCode,
    isInvalid: invalidElements ? invalidElements.includes(element.id) : false,
    locale,
    isStorageConfigured,
    isExternalUrlsAllowed,
  });

  // Element form components mapped by type
  const elementFormMap = {
    [TSurveyElementTypeEnum.OpenText]: OpenElementForm,
    [TSurveyElementTypeEnum.MultipleChoiceSingle]: MultipleChoiceElementForm,
    [TSurveyElementTypeEnum.MultipleChoiceMulti]: MultipleChoiceElementForm,
    [TSurveyElementTypeEnum.NPS]: NPSElementForm,
    [TSurveyElementTypeEnum.CTA]: CTAElementForm,
    [TSurveyElementTypeEnum.Rating]: RatingElementForm,
    [TSurveyElementTypeEnum.Consent]: ConsentElementForm,
    [TSurveyElementTypeEnum.Date]: DateElementForm,
    [TSurveyElementTypeEnum.PictureSelection]: PictureSelectionForm,
    [TSurveyElementTypeEnum.FileUpload]: FileUploadElementForm,
    [TSurveyElementTypeEnum.Cal]: CalElementForm,
    [TSurveyElementTypeEnum.Matrix]: MatrixElementForm,
    [TSurveyElementTypeEnum.Address]: AddressElementForm,
    [TSurveyElementTypeEnum.Ranking]: RankingElementForm,
    [TSurveyElementTypeEnum.ContactInfo]: ContactInfoElementForm,
  };

  // Elements that need lastElement prop
  const elementsWithLastElement = new Set([
    TSurveyElementTypeEnum.OpenText,
    TSurveyElementTypeEnum.CTA,
    TSurveyElementTypeEnum.Rating,
    TSurveyElementTypeEnum.Cal,
    TSurveyElementTypeEnum.ContactInfo,
  ]);

  const renderElementForm = (element: TSurveyElement, elementIdx: number) => {
    const FormComponent = elementFormMap[element.type];
    if (!FormComponent) return null;

    const commonProps = getCommonFormProps(element, elementIdx);

    // Add lastElement for specific element types
    const additionalProps: Record<string, unknown> = {};
    if (elementsWithLastElement.has(element.type)) {
      additionalProps.lastElement = lastElement;
    }

    // FileUpload needs extra props
    if (element.type === TSurveyElementTypeEnum.FileUpload) {
      additionalProps.project = project;
      additionalProps.isFormbricksCloud = isFormbricksCloud;
    }

    // @ts-expect-error - These props should cover everything
    return <FormComponent {...commonProps} {...additionalProps} />;
  };

  const style = {
    transition: transition ?? "transform 100ms ease",
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 10 : 1,
  };

  const blockElementsCount = block.elements.length;
  const blockElementsCountText = blockElementsCount === 1 ? "question" : "questions";

  let blockSidebarColorClass = "";
  if (isBlockInvalid) {
    blockSidebarColorClass = "bg-red-400";
  } else {
    blockSidebarColorClass = isBlockOpen ? "bg-slate-700" : "bg-slate-400";
  }

  return (
    <div
      className={cn(
        isBlockOpen ? "shadow-lg" : "shadow-md",
        "flex w-full flex-row rounded-lg bg-white duration-300"
      )}
      ref={setNodeRef}
      style={style}
      id={block.id}>
      <div
        {...listeners}
        {...attributes}
        className={cn(
          // isBlockInvalid ? "bg-red-400" : isBlockOpen ? "bg-slate-700" : "bg-slate-400",
          blockSidebarColorClass,
          "top-0 w-10 rounded-l-lg p-2 text-center text-sm text-white hover:cursor-grab hover:bg-slate-600",
          "flex flex-col items-center justify-between gap-2"
        )}>
        <div className="mt-3 flex w-full items-center justify-center rounded-full bg-white p-1 text-xs font-medium text-slate-900">
          {blockIdx + 1}
        </div>

        <button
          className="opacity-0 group-hover:opacity-100 hover:cursor-move"
          aria-label="Drag to reorder block">
          <GripIcon className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 rounded-r-lg border border-slate-200">
        <Collapsible.Root
          open={!isBlockCollapsed}
          onOpenChange={() => setIsBlockCollapsed(!isBlockCollapsed)}
          className={cn(isBlockCollapsed ? "h-full" : "")}>
          <Collapsible.CollapsibleTrigger asChild>
            <div className="block h-full w-full cursor-pointer hover:bg-slate-100">
              <div className="flex h-full items-center justify-between px-4 py-2">
                <div className="flex items-center gap-2">
                  <div>
                    <h4 className="text-sm font-medium text-slate-700">{block.name}</h4>
                    <p className="text-xs text-slate-500">
                      {blockElementsCount} {blockElementsCountText}
                    </p>
                  </div>
                </div>
                <div>
                  <BlockMenu
                    isFirstBlock={blockIdx === 0}
                    isLastBlock={blockIdx === totalBlocks - 1}
                    isOnlyBlock={totalBlocks === 1}
                    onDuplicate={() => duplicateBlock(block.id)}
                    onDelete={() => deleteBlock(block.id)}
                    onMoveUp={() => moveBlock(block.id, "up")}
                    onMoveDown={() => moveBlock(block.id, "down")}
                  />
                </div>
              </div>
            </div>
          </Collapsible.CollapsibleTrigger>

          <Collapsible.CollapsibleContent>
            {/* Render each element in the block */}
            <div ref={elementsParent}>
              {block.elements.map((element, elementIndex) => {
                // Calculate the actual element index in the flattened elements array
                let elementIdx = 0;
                for (let i = 0; i < blockIdx; i++) {
                  elementIdx += localSurvey.blocks[i].elements.length;
                }
                elementIdx += elementIndex;

                const isOpen = activeElementId === element.id;

                return (
                  <div key={element.id} className={cn(elementIndex > 0 && "border-t border-slate-200")}>
                    <Collapsible.Root
                      open={isOpen}
                      onOpenChange={() => {
                        if (activeElementId !== element.id) {
                          setActiveElementId(element.id);
                        } else {
                          setActiveElementId(null);
                        }
                      }}
                      className="w-full">
                      <Collapsible.CollapsibleTrigger
                        asChild
                        className={cn(
                          isOpen ? "bg-slate-50" : "",
                          "flex w-full cursor-pointer justify-between gap-4 p-4 hover:bg-slate-50"
                        )}
                        aria-label="Toggle question details">
                        <div>
                          <div className="flex grow">
                            <div className="flex grow items-center gap-3" dir="auto">
                              <div className="flex items-center text-slate-600">
                                {ELEMENTS_ICON_MAP[element.type]}
                              </div>
                              <div className="flex grow flex-col justify-center">
                                {hasMultipleElements && (
                                  <p className="mb-1 text-xs font-medium text-slate-500">
                                    Question {elementIndex + 1}
                                  </p>
                                )}
                                <h3 className="text-sm font-semibold">
                                  {getElementHeadline(element, selectedLanguageCode)}
                                </h3>
                                {!isOpen && element.type !== TSurveyElementTypeEnum.CTA && (
                                  <p className="mt-1 truncate text-xs text-slate-500">
                                    {element?.required
                                      ? t("environments.surveys.edit.required")
                                      : t("environments.surveys.edit.optional")}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            <EditorCardMenu
                              survey={localSurvey}
                              cardIdx={elementIdx}
                              lastCard={lastElement && elementIndex === lastElementIndex}
                              blockId={block.id}
                              elementIdx={elementIndex}
                              duplicateCard={duplicateElement}
                              deleteCard={deleteElement}
                              moveCard={moveElement}
                              card={{
                                ...element,
                                logic: block.logic,
                                buttonLabel: block.buttonLabel,
                                backButtonLabel: block.backButtonLabel,
                              }}
                              project={project}
                              updateCard={updateElement}
                              addCard={addElement}
                              addCardToBlock={addElementToBlock}
                              moveElementToBlock={moveElementToBlock}
                              cardType="element"
                              isCxMode={isCxMode}
                            />
                          </div>
                        </div>
                      </Collapsible.CollapsibleTrigger>
                      <Collapsible.CollapsibleContent className={`flex flex-col px-4 ${isOpen && "pb-4"}`}>
                        {shouldShowCautionAlert(element.type) && (
                          <Alert variant="warning" size="small" className="w-fill mt-2" role="alert">
                            <AlertTitle>{t("environments.surveys.edit.caution_text")}</AlertTitle>
                            <AlertButton onClick={() => onAlertTrigger()}>
                              {t("common.learn_more")}
                            </AlertButton>
                          </Alert>
                        )}
                        {renderElementForm(element, elementIdx)}
                        <div className="mt-4">
                          <Collapsible.Root
                            open={openAdvanced}
                            onOpenChange={setOpenAdvanced}
                            className="mt-5">
                            <Collapsible.CollapsibleTrigger
                              className="flex items-center text-sm text-slate-700"
                              aria-label="Toggle advanced settings">
                              {openAdvanced ? (
                                <ChevronDownIcon className="mr-1 h-4 w-3" />
                              ) : (
                                <ChevronRightIcon className="mr-2 h-4 w-3" />
                              )}
                              {openAdvanced
                                ? t("environments.surveys.edit.hide_question_settings")
                                : t("environments.surveys.edit.show_question_settings")}
                            </Collapsible.CollapsibleTrigger>

                            <Collapsible.CollapsibleContent className="flex flex-col gap-4" ref={parent}>
                              {element.type !== TSurveyElementTypeEnum.NPS &&
                              element.type !== TSurveyElementTypeEnum.Rating &&
                              element.type !== TSurveyElementTypeEnum.CTA ? (
                                <div className="mt-2 flex space-x-2"></div>
                              ) : null}
                              <AdvancedSettings
                                // TODO -- We should remove this when we can confirm that everything works fine with the survey editor, not changing this right now in this file because it would require changing the element type to the respective element type in all the element forms.
                                element={element}
                                elementIdx={elementIdx}
                                localSurvey={localSurvey}
                                updateElement={updateElement}
                                updateBlockLogic={updateBlockLogic}
                                updateBlockLogicFallback={updateBlockLogicFallback}
                                selectedLanguageCode={selectedLanguageCode}
                              />
                            </Collapsible.CollapsibleContent>
                          </Collapsible.Root>
                        </div>
                      </Collapsible.CollapsibleContent>
                    </Collapsible.Root>
                  </div>
                );
              })}
            </div>
            <hr className="mb-4 border-dashed border-slate-200" />
            {/* Add Element to Block button */}

            <div className="p-4 pt-0">
              <AddElementToBlockButton
                localSurvey={localSurvey}
                setLocalSurvey={setLocalSurvey}
                setActiveElementId={setActiveElementId}
                block={block}
                project={project}
                isCxMode={isCxMode}
              />
            </div>

            <hr className="border-dashed border-slate-200" />

            {/* Block Settings */}
            <div className="p-4">
              <BlockSettings
                localSurvey={localSurvey}
                block={block}
                blockIndex={blockIdx}
                selectedLanguageCode={selectedLanguageCode}
                setSelectedLanguageCode={setSelectedLanguageCode}
                updateBlockButtonLabel={updateBlockButtonLabel}
                updateBlockLogic={updateBlockLogic}
                updateBlockLogicFallback={updateBlockLogicFallback}
                locale={locale}
                isStorageConfigured={isStorageConfigured}
                isLastBlock={blockIdx === totalBlocks - 1}
              />
            </div>
          </Collapsible.CollapsibleContent>
        </Collapsible.Root>
      </div>
    </div>
  );
};
