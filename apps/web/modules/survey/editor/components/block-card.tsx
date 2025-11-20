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
import { QuestionFormInput } from "@/modules/survey/components/question-form-input";
import { AddQuestionToBlockButton } from "@/modules/survey/editor/components/add-question-to-block-button";
import { AddressQuestionForm } from "@/modules/survey/editor/components/address-question-form";
import { AdvancedSettings } from "@/modules/survey/editor/components/advanced-settings";
import { BlockMenu } from "@/modules/survey/editor/components/block-menu";
import { CalQuestionForm } from "@/modules/survey/editor/components/cal-question-form";
import { ConsentQuestionForm } from "@/modules/survey/editor/components/consent-question-form";
import { ContactInfoQuestionForm } from "@/modules/survey/editor/components/contact-info-question-form";
import { CTAQuestionForm } from "@/modules/survey/editor/components/cta-question-form";
import { DateQuestionForm } from "@/modules/survey/editor/components/date-question-form";
import { EditorCardMenu } from "@/modules/survey/editor/components/editor-card-menu";
import { FileUploadQuestionForm } from "@/modules/survey/editor/components/file-upload-question-form";
import { MatrixQuestionForm } from "@/modules/survey/editor/components/matrix-question-form";
import { MultipleChoiceQuestionForm } from "@/modules/survey/editor/components/multiple-choice-question-form";
import { NPSQuestionForm } from "@/modules/survey/editor/components/nps-question-form";
import { OpenQuestionForm } from "@/modules/survey/editor/components/open-question-form";
import { PictureSelectionForm } from "@/modules/survey/editor/components/picture-selection-form";
import { RankingQuestionForm } from "@/modules/survey/editor/components/ranking-question-form";
import { RatingQuestionForm } from "@/modules/survey/editor/components/rating-question-form";
import { formatTextWithSlashes } from "@/modules/survey/editor/lib/utils";
import { getQuestionIconMap, getTSurveyQuestionTypeEnumName } from "@/modules/survey/lib/questions";
import { Alert, AlertButton, AlertTitle } from "@/modules/ui/components/alert";
import { Label } from "@/modules/ui/components/label";
import { Switch } from "@/modules/ui/components/switch";

interface BlockCardProps {
  localSurvey: TSurvey;
  project: Project;
  block: TSurveyBlock;
  blockIdx: number;
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
  lastQuestion: boolean;
  lastElementIndex: number;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (language: string) => void;
  invalidQuestions?: string[];
  addQuestion: (question: any, index?: number) => void;
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
  totalBlocks: number;
}

export const BlockCard = ({
  localSurvey,
  project,
  block,
  blockIdx,
  moveQuestion,
  updateQuestion,
  updateBlockLogic,
  updateBlockLogicFallback,
  updateBlockButtonLabel,
  duplicateQuestion,
  deleteQuestion,
  activeQuestionId,
  setActiveQuestionId,
  lastQuestion,
  lastElementIndex,
  selectedLanguageCode,
  setSelectedLanguageCode,
  invalidQuestions,
  addQuestion,
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
  totalBlocks,
}: BlockCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });
  const { t } = useTranslation();
  const QUESTIONS_ICON_MAP = getQuestionIconMap(t);

  // Block-level properties
  const blockName = block.name || `Block ${blockIdx + 1}`;
  const hasMultipleElements = block.elements.length > 1;
  const blockLogic = block.logic ?? [];

  // Check if any element in this block is currently active
  const isBlockOpen = block.elements.some((element) => element.id === activeQuestionId);

  const [openAdvanced, setOpenAdvanced] = useState(blockLogic.length > 0);
  const [parent] = useAutoAnimate();

  // Get button labels from the block
  const blockButtonLabel = block.buttonLabel;
  const blockBackButtonLabel = block.backButtonLabel;

  const updateEmptyButtonLabels = (
    labelKey: "buttonLabel" | "backButtonLabel",
    labelValue: TI18nString,
    skipBlockIndex: number
  ) => {
    // Update button labels for all blocks except the one at skipBlockIndex
    localSurvey.blocks.forEach((block, index) => {
      if (index === skipBlockIndex) return;
      const currentLabel = block[labelKey];
      if (!currentLabel || currentLabel[selectedLanguageCode]?.trim() === "") {
        updateBlockButtonLabel(index, labelKey, labelValue);
      }
    });
  };

  const getElementHeadline = (
    element: TSurveyElement,
    languageCode: string
  ): (string | React.ReactElement)[] | string | undefined => {
    const headlineData = recallToHeadline(element.headline, localSurvey, true, languageCode);
    const headlineText = headlineData[languageCode];
    if (headlineText) {
      return formatTextWithSlashes(getTextContent(headlineText ?? ""));
    }
    return getTSurveyQuestionTypeEnumName(element.type, t);
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

  const renderElementForm = (
    element: TSurveyElement,
    questionIdx: number,
    blockButtonLabel?: TI18nString
  ) => {
    switch (element.type) {
      case TSurveyElementTypeEnum.OpenText:
        return (
          <OpenQuestionForm
            localSurvey={localSurvey}
            question={element}
            questionIdx={questionIdx}
            updateQuestion={updateQuestion}
            lastQuestion={lastQuestion}
            selectedLanguageCode={selectedLanguageCode}
            setSelectedLanguageCode={setSelectedLanguageCode}
            isInvalid={invalidQuestions ? invalidQuestions.includes(element.id) : false}
            locale={locale}
            isStorageConfigured={isStorageConfigured}
            isExternalUrlsAllowed={isExternalUrlsAllowed}
          />
        );
      case TSurveyElementTypeEnum.MultipleChoiceSingle:
        return (
          <MultipleChoiceQuestionForm
            localSurvey={localSurvey}
            question={element}
            questionIdx={questionIdx}
            updateQuestion={updateQuestion}
            selectedLanguageCode={selectedLanguageCode}
            setSelectedLanguageCode={setSelectedLanguageCode}
            isInvalid={invalidQuestions ? invalidQuestions.includes(element.id) : false}
            locale={locale}
            isStorageConfigured={isStorageConfigured}
            isExternalUrlsAllowed={isExternalUrlsAllowed}
          />
        );
      case TSurveyElementTypeEnum.MultipleChoiceMulti:
        return (
          <MultipleChoiceQuestionForm
            localSurvey={localSurvey}
            question={element}
            questionIdx={questionIdx}
            updateQuestion={updateQuestion}
            selectedLanguageCode={selectedLanguageCode}
            setSelectedLanguageCode={setSelectedLanguageCode}
            isInvalid={invalidQuestions ? invalidQuestions.includes(element.id) : false}
            locale={locale}
            isStorageConfigured={isStorageConfigured}
            isExternalUrlsAllowed={isExternalUrlsAllowed}
          />
        );
      case TSurveyElementTypeEnum.NPS:
        return (
          <NPSQuestionForm
            localSurvey={localSurvey}
            question={element}
            questionIdx={questionIdx}
            updateQuestion={updateQuestion}
            lastQuestion={lastQuestion}
            selectedLanguageCode={selectedLanguageCode}
            setSelectedLanguageCode={setSelectedLanguageCode}
            isInvalid={invalidQuestions ? invalidQuestions.includes(element.id) : false}
            locale={locale}
            isStorageConfigured={isStorageConfigured}
            isExternalUrlsAllowed={isExternalUrlsAllowed}
            buttonLabel={blockButtonLabel}
          />
        );
      case TSurveyElementTypeEnum.CTA:
        return (
          <CTAQuestionForm
            localSurvey={localSurvey}
            question={element}
            questionIdx={questionIdx}
            updateQuestion={updateQuestion}
            lastQuestion={lastQuestion}
            selectedLanguageCode={selectedLanguageCode}
            setSelectedLanguageCode={setSelectedLanguageCode}
            isInvalid={invalidQuestions ? invalidQuestions.includes(element.id) : false}
            locale={locale}
            isStorageConfigured={isStorageConfigured}
            isExternalUrlsAllowed={isExternalUrlsAllowed}
          />
        );
      case TSurveyElementTypeEnum.Rating:
        return (
          <RatingQuestionForm
            localSurvey={localSurvey}
            question={element}
            questionIdx={questionIdx}
            updateQuestion={updateQuestion}
            lastQuestion={lastQuestion}
            selectedLanguageCode={selectedLanguageCode}
            setSelectedLanguageCode={setSelectedLanguageCode}
            isInvalid={invalidQuestions ? invalidQuestions.includes(element.id) : false}
            locale={locale}
            isStorageConfigured={isStorageConfigured}
            isExternalUrlsAllowed={isExternalUrlsAllowed}
          />
        );
      case TSurveyElementTypeEnum.Consent:
        return (
          <ConsentQuestionForm
            localSurvey={localSurvey}
            question={element}
            questionIdx={questionIdx}
            updateQuestion={updateQuestion}
            selectedLanguageCode={selectedLanguageCode}
            setSelectedLanguageCode={setSelectedLanguageCode}
            isInvalid={invalidQuestions ? invalidQuestions.includes(element.id) : false}
            locale={locale}
            isStorageConfigured={isStorageConfigured}
            isExternalUrlsAllowed={isExternalUrlsAllowed}
          />
        );
      case TSurveyElementTypeEnum.Date:
        return (
          <DateQuestionForm
            localSurvey={localSurvey}
            question={element}
            questionIdx={questionIdx}
            updateQuestion={updateQuestion}
            selectedLanguageCode={selectedLanguageCode}
            setSelectedLanguageCode={setSelectedLanguageCode}
            isInvalid={invalidQuestions ? invalidQuestions.includes(element.id) : false}
            locale={locale}
            isStorageConfigured={isStorageConfigured}
            isExternalUrlsAllowed={isExternalUrlsAllowed}
          />
        );
      case TSurveyElementTypeEnum.PictureSelection:
        return (
          <PictureSelectionForm
            localSurvey={localSurvey}
            question={element}
            questionIdx={questionIdx}
            updateQuestion={updateQuestion}
            selectedLanguageCode={selectedLanguageCode}
            setSelectedLanguageCode={setSelectedLanguageCode}
            isInvalid={invalidQuestions ? invalidQuestions.includes(element.id) : false}
            locale={locale}
            isStorageConfigured={isStorageConfigured}
          />
        );
      case TSurveyElementTypeEnum.FileUpload:
        return (
          <FileUploadQuestionForm
            localSurvey={localSurvey}
            project={project}
            question={element}
            questionIdx={questionIdx}
            updateQuestion={updateQuestion}
            selectedLanguageCode={selectedLanguageCode}
            setSelectedLanguageCode={setSelectedLanguageCode}
            isInvalid={invalidQuestions ? invalidQuestions.includes(element.id) : false}
            isFormbricksCloud={isFormbricksCloud}
            locale={locale}
            isStorageConfigured={isStorageConfigured}
            isExternalUrlsAllowed={isExternalUrlsAllowed}
          />
        );
      case TSurveyElementTypeEnum.Cal:
        return (
          <CalQuestionForm
            localSurvey={localSurvey}
            question={element}
            questionIdx={questionIdx}
            updateQuestion={updateQuestion}
            lastQuestion={lastQuestion}
            selectedLanguageCode={selectedLanguageCode}
            setSelectedLanguageCode={setSelectedLanguageCode}
            isInvalid={invalidQuestions ? invalidQuestions.includes(element.id) : false}
            locale={locale}
            isStorageConfigured={isStorageConfigured}
            isExternalUrlsAllowed={isExternalUrlsAllowed}
          />
        );
      case TSurveyElementTypeEnum.Matrix:
        return (
          <MatrixQuestionForm
            localSurvey={localSurvey}
            question={element}
            questionIdx={questionIdx}
            updateQuestion={updateQuestion}
            selectedLanguageCode={selectedLanguageCode}
            setSelectedLanguageCode={setSelectedLanguageCode}
            isInvalid={invalidQuestions ? invalidQuestions.includes(element.id) : false}
            locale={locale}
            isStorageConfigured={isStorageConfigured}
            isExternalUrlsAllowed={isExternalUrlsAllowed}
          />
        );
      case TSurveyElementTypeEnum.Address:
        return (
          <AddressQuestionForm
            localSurvey={localSurvey}
            question={element}
            questionIdx={questionIdx}
            updateQuestion={updateQuestion}
            selectedLanguageCode={selectedLanguageCode}
            setSelectedLanguageCode={setSelectedLanguageCode}
            isInvalid={invalidQuestions ? invalidQuestions.includes(element.id) : false}
            locale={locale}
            isStorageConfigured={isStorageConfigured}
            isExternalUrlsAllowed={isExternalUrlsAllowed}
          />
        );
      case TSurveyElementTypeEnum.Ranking:
        return (
          <RankingQuestionForm
            localSurvey={localSurvey}
            question={element}
            questionIdx={questionIdx}
            updateQuestion={updateQuestion}
            selectedLanguageCode={selectedLanguageCode}
            setSelectedLanguageCode={setSelectedLanguageCode}
            isInvalid={invalidQuestions ? invalidQuestions.includes(element.id) : false}
            locale={locale}
            isStorageConfigured={isStorageConfigured}
            isExternalUrlsAllowed={isExternalUrlsAllowed}
          />
        );
      case TSurveyElementTypeEnum.ContactInfo:
        return (
          <ContactInfoQuestionForm
            localSurvey={localSurvey}
            question={element}
            questionIdx={questionIdx}
            updateQuestion={updateQuestion}
            lastQuestion={lastQuestion}
            selectedLanguageCode={selectedLanguageCode}
            setSelectedLanguageCode={setSelectedLanguageCode}
            isInvalid={invalidQuestions ? invalidQuestions.includes(element.id) : false}
            locale={locale}
            isStorageConfigured={isStorageConfigured}
            isExternalUrlsAllowed={isExternalUrlsAllowed}
          />
        );
      default:
        return null;
    }
  };

  const style = {
    transition: transition ?? "transform 100ms ease",
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 10 : 1,
  };

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
          isBlockOpen ? "bg-slate-700" : "bg-slate-400",
          "top-0 w-10 rounded-l-lg p-2 text-center text-sm text-white hover:cursor-grab hover:bg-slate-600",
          "flex flex-col items-center justify-between"
        )}>
        <div className="mt-3 flex w-full items-center justify-center text-xs font-medium">{blockIdx + 1}</div>

        <button
          className="opacity-0 hover:cursor-move group-hover:opacity-100"
          aria-label="Drag to reorder block">
          <GripIcon className="h-4 w-4" />
        </button>
      </div>
      <div className="w-[95%] flex-1 rounded-r-lg border border-slate-200">
        {/* Block header - shown when block has multiple elements */}
        {hasMultipleElements && (
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2">
            <div>
              <h4 className="text-sm font-medium text-slate-700">{blockName}</h4>
              <p className="text-xs text-slate-500">{block.elements.length} questions</p>
            </div>
            <BlockMenu
              blockIndex={blockIdx}
              isFirstBlock={blockIdx === 0}
              isLastBlock={blockIdx === totalBlocks - 1}
              onDuplicate={() => duplicateBlock(block.id)}
              onDelete={() => deleteBlock(block.id)}
              onMoveUp={() => moveBlock(block.id, "up")}
              onMoveDown={() => moveBlock(block.id, "down")}
            />
          </div>
        )}

        {/* Render each element in the block */}
        {block.elements.map((element, elementIndex) => {
          // Calculate the actual question index in the flattened questions array
          let questionIdx = 0;
          for (let i = 0; i < blockIdx; i++) {
            questionIdx += localSurvey.blocks[i].elements.length;
          }
          questionIdx += elementIndex;

          const isInvalid = invalidQuestions ? invalidQuestions.includes(element.id) : false;
          const open = activeQuestionId === element.id;

          const getIsRequiredToggleDisabled = (): boolean => {
            if (element.type === TSurveyElementTypeEnum.Address) {
              const allFieldsAreOptional = [
                element.addressLine1,
                element.addressLine2,
                element.city,
                element.state,
                element.zip,
                element.country,
              ]
                .filter((field) => field.show)
                .every((field) => !field.required);

              if (allFieldsAreOptional) {
                return true;
              }

              return [
                element.addressLine1,
                element.addressLine2,
                element.city,
                element.state,
                element.zip,
                element.country,
              ]
                .filter((field) => field.show)
                .some((condition) => condition.required === true);
            }

            if (element.type === TSurveyElementTypeEnum.ContactInfo) {
              const allFieldsAreOptional = [
                element.firstName,
                element.lastName,
                element.email,
                element.phone,
                element.company,
              ]
                .filter((field) => field.show)
                .every((field) => !field.required);

              if (allFieldsAreOptional) {
                return true;
              }

              return [element.firstName, element.lastName, element.email, element.phone, element.company]
                .filter((field) => field.show)
                .some((condition) => condition.required === true);
            }

            return false;
          };

          const handleRequiredToggle = () => {
            // Fix for NPS and Rating element having missing translations when buttonLabel is not removed
            if (!element.required && (element.type === "nps" || element.type === "rating")) {
              // Remove buttonLabel from the block when making NPS/Rating required
              updateBlockButtonLabel(blockIdx, "buttonLabel", undefined);
              updateQuestion(questionIdx, { required: true });
            } else {
              updateQuestion(questionIdx, { required: !element.required });
            }
          };

          return (
            <div key={element.id} className={cn(elementIndex > 0 && "border-t border-slate-200")}>
              <Collapsible.Root
                open={open}
                onOpenChange={() => {
                  if (activeQuestionId !== element.id) {
                    setActiveQuestionId(element.id);
                  } else {
                    setActiveQuestionId(null);
                  }
                }}
                className="w-full">
                <Collapsible.CollapsibleTrigger
                  asChild
                  className={cn(
                    open ? "bg-slate-50" : "",
                    "flex w-full cursor-pointer justify-between gap-4 p-4 hover:bg-slate-50"
                  )}
                  aria-label="Toggle question details">
                  <div>
                    <div className="flex grow">
                      <div className="flex grow items-center gap-3" dir="auto">
                        <div className="flex items-center text-slate-600">
                          {QUESTIONS_ICON_MAP[element.type]}
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
                          {!open && (
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
                        cardIdx={questionIdx}
                        lastCard={lastQuestion && elementIndex === lastElementIndex}
                        blockId={block.id}
                        elementIdx={elementIndex}
                        duplicateCard={duplicateQuestion}
                        deleteCard={deleteQuestion}
                        moveCard={moveQuestion}
                        card={{
                          ...element,
                          logic: block.logic,
                          buttonLabel: block.buttonLabel,
                          backButtonLabel: block.backButtonLabel,
                        }}
                        project={project}
                        updateCard={updateQuestion}
                        addCard={addQuestion}
                        addCardToBlock={addElementToBlock}
                        cardType="question"
                        isCxMode={isCxMode}
                      />
                    </div>
                  </div>
                </Collapsible.CollapsibleTrigger>
                <Collapsible.CollapsibleContent className={`flex flex-col px-4 ${open && "pb-4"}`}>
                  {shouldShowCautionAlert(element.type) && (
                    <Alert variant="warning" size="small" className="w-fill" role="alert">
                      <AlertTitle>{t("environments.surveys.edit.caution_text")}</AlertTitle>
                      <AlertButton onClick={() => onAlertTrigger()}>{t("common.learn_more")}</AlertButton>
                    </Alert>
                  )}

                  {renderElementForm(element, questionIdx, blockButtonLabel)}
                  <div className="mt-4">
                    <Collapsible.Root open={openAdvanced} onOpenChange={setOpenAdvanced} className="mt-5">
                      <Collapsible.CollapsibleTrigger
                        className="flex items-center text-sm text-slate-700"
                        aria-label="Toggle advanced settings">
                        {openAdvanced ? (
                          <ChevronDownIcon className="mr-1 h-4 w-3" />
                        ) : (
                          <ChevronRightIcon className="mr-2 h-4 w-3" />
                        )}
                        {openAdvanced
                          ? t("environments.surveys.edit.hide_advanced_settings")
                          : t("environments.surveys.edit.show_advanced_settings")}
                      </Collapsible.CollapsibleTrigger>

                      <Collapsible.CollapsibleContent className="flex flex-col gap-4" ref={parent}>
                        {element.type !== TSurveyElementTypeEnum.NPS &&
                        element.type !== TSurveyElementTypeEnum.Rating &&
                        element.type !== TSurveyElementTypeEnum.CTA ? (
                          <div className="mt-2 flex space-x-2">
                            {questionIdx !== 0 && (
                              <QuestionFormInput
                                id="backButtonLabel"
                                value={blockBackButtonLabel}
                                label={t("environments.surveys.edit.back_button_label")}
                                localSurvey={localSurvey}
                                questionIdx={questionIdx}
                                maxLength={48}
                                placeholder={t("common.back")}
                                isInvalid={isInvalid}
                                updateQuestion={updateQuestion}
                                selectedLanguageCode={selectedLanguageCode}
                                setSelectedLanguageCode={setSelectedLanguageCode}
                                locale={locale}
                                onBlur={(e) => {
                                  if (!blockBackButtonLabel) return;
                                  let translatedBackButtonLabel = {
                                    ...blockBackButtonLabel,
                                    [selectedLanguageCode]: e.target.value,
                                  };
                                  updateBlockButtonLabel(
                                    blockIdx,
                                    "backButtonLabel",
                                    translatedBackButtonLabel
                                  );
                                  updateEmptyButtonLabels(
                                    "backButtonLabel",
                                    translatedBackButtonLabel,
                                    blockIdx
                                  );
                                }}
                                isStorageConfigured={isStorageConfigured}
                              />
                            )}
                            <div className="w-full">
                              <QuestionFormInput
                                id="buttonLabel"
                                value={blockButtonLabel}
                                label={t("environments.surveys.edit.next_button_label")}
                                localSurvey={localSurvey}
                                questionIdx={questionIdx}
                                maxLength={48}
                                placeholder={lastQuestion ? t("common.finish") : t("common.next")}
                                isInvalid={isInvalid}
                                updateQuestion={updateQuestion}
                                selectedLanguageCode={selectedLanguageCode}
                                setSelectedLanguageCode={setSelectedLanguageCode}
                                onBlur={(e) => {
                                  if (!blockButtonLabel) return;
                                  let translatedNextButtonLabel = {
                                    ...blockButtonLabel,
                                    [selectedLanguageCode]: e.target.value,
                                  };
                                  updateBlockButtonLabel(blockIdx, "buttonLabel", translatedNextButtonLabel);
                                  // Don't propagate to last block
                                  const lastBlockIndex = localSurvey.blocks.length - 1;
                                  if (blockIdx !== lastBlockIndex) {
                                    updateEmptyButtonLabels(
                                      "buttonLabel",
                                      translatedNextButtonLabel,
                                      lastBlockIndex
                                    );
                                  }
                                }}
                                locale={locale}
                                isStorageConfigured={isStorageConfigured}
                              />
                            </div>
                          </div>
                        ) : null}
                        {(element.type === TSurveyElementTypeEnum.Rating ||
                          element.type === TSurveyElementTypeEnum.NPS) &&
                          questionIdx !== 0 && (
                            <div className="mt-4">
                              <QuestionFormInput
                                id="backButtonLabel"
                                value={blockBackButtonLabel}
                                label={`"Back" Button Label`}
                                localSurvey={localSurvey}
                                questionIdx={questionIdx}
                                maxLength={48}
                                placeholder={"Back"}
                                isInvalid={isInvalid}
                                updateQuestion={updateQuestion}
                                selectedLanguageCode={selectedLanguageCode}
                                setSelectedLanguageCode={setSelectedLanguageCode}
                                locale={locale}
                                onBlur={(e) => {
                                  if (!blockBackButtonLabel) return;
                                  const translatedBackButtonLabel = {
                                    ...blockBackButtonLabel,
                                    [selectedLanguageCode]: e.target.value,
                                  };
                                  updateBlockButtonLabel(
                                    blockIdx,
                                    "backButtonLabel",
                                    translatedBackButtonLabel
                                  );
                                  updateEmptyButtonLabels(
                                    "backButtonLabel",
                                    translatedBackButtonLabel,
                                    blockIdx
                                  );
                                }}
                                isStorageConfigured={isStorageConfigured}
                              />
                            </div>
                          )}

                        <AdvancedSettings
                          // TODO -- We should remove this when we can confirm that everything works fine with the survey editor, not changing this right now in this file because it would require changing the question type to the respective element type in all the question forms.
                          question={element}
                          questionIdx={questionIdx}
                          localSurvey={localSurvey}
                          updateQuestion={updateQuestion}
                          updateBlockLogic={updateBlockLogic}
                          updateBlockLogicFallback={updateBlockLogicFallback}
                          selectedLanguageCode={selectedLanguageCode}
                        />
                      </Collapsible.CollapsibleContent>
                    </Collapsible.Root>
                  </div>
                </Collapsible.CollapsibleContent>

                {open && (
                  <div className="mx-4 flex justify-end space-x-6 border-t border-slate-200">
                    {element.type === "openText" && (
                      <div className="my-4 flex items-center justify-end space-x-2">
                        <Label htmlFor="longAnswer">{t("environments.surveys.edit.long_answer")}</Label>
                        <Switch
                          id="longAnswer"
                          disabled={element.inputType !== "text"}
                          checked={element.longAnswer !== false}
                          onClick={(e) => {
                            e.stopPropagation();
                            updateQuestion(questionIdx, {
                              longAnswer:
                                typeof element.longAnswer === "undefined" ? false : !element.longAnswer,
                            });
                          }}
                        />
                      </div>
                    )}
                    {
                      <div className="my-4 flex items-center justify-end space-x-2">
                        <Label htmlFor="required-toggle">{t("environments.surveys.edit.required")}</Label>
                        <Switch
                          id="required-toggle"
                          checked={element.required}
                          disabled={getIsRequiredToggleDisabled()}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRequiredToggle();
                          }}
                        />
                      </div>
                    }
                  </div>
                )}
              </Collapsible.Root>
            </div>
          );
        })}

        {/* Add Question to Block button */}

        <div className="p-4">
          <AddQuestionToBlockButton
            localSurvey={localSurvey}
            setLocalSurvey={setLocalSurvey}
            block={block}
            project={project}
            isCxMode={isCxMode}
          />
        </div>
      </div>
    </div>
  );
};
