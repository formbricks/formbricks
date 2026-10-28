"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { GripIcon, PencilIcon } from "lucide-react";
import { type Dispatch, type KeyboardEvent, type SetStateAction, memo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { TI18nString } from "@formbricks/types/i18n";
import { TSurveyBlock, TSurveyBlockLogic } from "@formbricks/types/surveys/blocks";
import { TSurveyElement, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { TUserLocale } from "@formbricks/types/user";
import { cn } from "@/lib/cn";
import { recallToHeadline } from "@/lib/utils/recall";
import { type TWorkspaceWithoutCustomCss } from "@/modules/custom-css/lib/types";
import { AddElementToBlockButton } from "@/modules/survey/editor/components/add-element-to-block-button";
import { AddressElementForm } from "@/modules/survey/editor/components/address-element-form";
import { AdvancedSettings } from "@/modules/survey/editor/components/advanced-settings";
import { BlockMenu } from "@/modules/survey/editor/components/block-menu";
import { BlockSettings } from "@/modules/survey/editor/components/block-settings";
import { CalElementForm } from "@/modules/survey/editor/components/cal-element-form";
import { CESElementForm } from "@/modules/survey/editor/components/ces-element-form";
import { ConditionalLogic } from "@/modules/survey/editor/components/conditional-logic";
import { ConsentElementForm } from "@/modules/survey/editor/components/consent-element-form";
import { ContactInfoElementForm } from "@/modules/survey/editor/components/contact-info-element-form";
import { CSATElementForm } from "@/modules/survey/editor/components/csat-element-form";
import { CTAElementForm } from "@/modules/survey/editor/components/cta-element-form";
import { DateElementForm } from "@/modules/survey/editor/components/date-element-form";
import { EditorCardMenu } from "@/modules/survey/editor/components/editor-card-menu";
import { FileUploadElementForm } from "@/modules/survey/editor/components/file-upload-element-form";
import { MatrixElementForm } from "@/modules/survey/editor/components/matrix-element-form";
import { MultipleChoiceElementForm } from "@/modules/survey/editor/components/multiple-choice-element-form";
import { NPSElementForm } from "@/modules/survey/editor/components/nps-element-form";
import { OpenElementForm } from "@/modules/survey/editor/components/open-element-form";
import { PictureSelectionForm } from "@/modules/survey/editor/components/picture-selection-form";
import { QuestionTabs } from "@/modules/survey/editor/components/question-tabs";
import { RankingElementForm } from "@/modules/survey/editor/components/ranking-element-form";
import { RatingElementForm } from "@/modules/survey/editor/components/rating-element-form";
import { areBlockCardPropsEqual } from "@/modules/survey/editor/lib/block-card-memo";
import { BLOCK_NAME_MAX_LENGTH } from "@/modules/survey/editor/lib/blocks";
import { getElementCodeIssues } from "@/modules/survey/editor/lib/element-codes";
import { getElementLock } from "@/modules/survey/editor/lib/published-lock";
import { formatTextWithSlashes } from "@/modules/survey/editor/lib/utils";
import { getElementIconMap, getTSurveyElementTypeEnumName } from "@/modules/survey/lib/elements";
import { Alert, AlertButton, AlertTitle } from "@/modules/ui/components/alert";
import { Input } from "@/modules/ui/components/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/modules/ui/components/tabs";

interface BlockCardProps {
  localSurvey: TSurvey;
  /** The survey as last saved. The published lock is read from it, not from the working copy. */
  persistedSurvey: TSurvey;
  workspace: TWorkspaceWithoutCustomCss;
  block: TSurveyBlock;
  blockIdx: number;
  moveElement: (elementIdx: number, up: boolean) => void;
  updateElement: (elementIdx: number, updatedAttributes: any) => void;
  updateBlockLogic: (elementIdx: number, logic: TSurveyBlockLogic[]) => void;
  updateBlockLogicFallback: (elementIdx: number, logicFallback: string | undefined) => void;
  updateBlockName: (blockIdx: number, name: string) => void;
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
  invalidElements?: string[];
  addElement: (element: any, index?: number) => void;
  isFormbricksCloud: boolean;
  isCxMode: boolean;
  locale: TUserLocale;
  responseCount: number;
  onAlertTrigger: () => void;
  isStorageConfigured: boolean;
  isExternalUrlsAllowed: boolean;
  setLocalSurvey: Dispatch<SetStateAction<TSurvey>>;
  duplicateBlock: (blockId: string) => void;
  deleteBlock: (blockId: string) => void;
  moveBlock: (blockId: string, direction: "up" | "down") => void;
  addElementToBlock: (element: TSurveyElement, blockId: string, afterElementIdx: number) => void;
  moveElementToBlock?: (elementId: string, targetBlockId: string) => void;
  totalBlocks: number;
  // Read only by the memo comparator: the last-pressed/focused card re-renders on every survey change.
  isLastInteracted: boolean;
  onInteract: (blockId: string) => void;
}

const BlockCardComponent = ({
  localSurvey,
  persistedSurvey,
  workspace,
  block,
  blockIdx,
  moveElement,
  updateElement,
  updateBlockLogic,
  updateBlockLogicFallback,
  updateBlockName,
  updateBlockButtonLabel,
  duplicateElement,
  deleteElement,
  activeElementId,
  setActiveElementId,
  lastElement,
  lastElementIndex,
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
  onInteract,
}: Readonly<BlockCardProps>) => {
  const selectedLanguageCode = "default";

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });
  const { t } = useTranslation();
  const ELEMENTS_ICON_MAP = getElementIconMap(t);

  const hasMultipleElements = block.elements.length > 1;
  const blockLogic = block.logic ?? [];

  // Check if any element in this block is currently active
  const isBlockOpen = block.elements.some((element) => element.id === activeElementId);

  // Code problems come from the live survey, so a duplicate shows before the next save or publish.
  const codeIssues = getElementCodeIssues(localSurvey);
  const hasInvalidElement = block.elements.some(
    (element) => invalidElements?.includes(element.id) || codeIssues.has(element.id)
  );
  const hasInvalidLogic = blockLogic.some((logicItem) => invalidElements?.includes(logicItem.id));
  // The block's own id is only ever flagged for an empty name (elements and logic rules use theirs).
  const hasInvalidName = invalidElements?.includes(block.id) ?? false;
  const isBlockInvalid = hasInvalidElement || hasInvalidLogic || hasInvalidName;

  const [isBlockCollapsed, setIsBlockCollapsed] = useState(false);
  const [blockTab, setBlockTab] = useState("questions");

  const nameInputRef = useRef<HTMLInputElement>(null);

  // Enter commits the rename by blurring, so the title reads as settled. There is nothing to flush:
  // the name is already in localSurvey and rides the editor's existing autosave.
  const handleNameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // An IME (Japanese/Chinese/Korean) uses Enter to accept the highlighted candidate, so blurring
    // there would commit a half-typed name. The synthetic event doesn't carry isComposing; the
    // native one does.
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    nameInputRef.current?.blur();
  };

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
        TSurveyElementTypeEnum.CSAT,
        TSurveyElementTypeEnum.CES,
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
    isInvalid: invalidElements ? invalidElements.includes(element.id) : false,
    locale,
    isStorageConfigured,
    isExternalUrlsAllowed,
    lock: getElementLock(persistedSurvey, element.id),
  });

  // Element form components mapped by type
  const elementFormMap = {
    [TSurveyElementTypeEnum.OpenText]: OpenElementForm,
    [TSurveyElementTypeEnum.MultipleChoiceSingle]: MultipleChoiceElementForm,
    [TSurveyElementTypeEnum.MultipleChoiceMulti]: MultipleChoiceElementForm,
    [TSurveyElementTypeEnum.NPS]: NPSElementForm,
    [TSurveyElementTypeEnum.CTA]: CTAElementForm,
    [TSurveyElementTypeEnum.Rating]: RatingElementForm,
    [TSurveyElementTypeEnum.CSAT]: CSATElementForm,
    [TSurveyElementTypeEnum.CES]: CESElementForm,
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
      additionalProps.workspace = workspace;
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
        // scroll-mt clears the fixed tabs bar (h-12) when scrolled into view on validation errors
        "flex w-full scroll-mt-16 flex-row rounded-lg bg-white duration-300"
      )}
      ref={setNodeRef}
      style={style}
      id={block.id}
      // Capture phase, so presses inside menus portaled out of the card count too. The re-render this
      // triggers is flushed before the click that follows (and together with a menu opened by this
      // press), so those see fresh props; a handler running in this same pointerdown does not.
      onPointerDownCapture={() => onInteract(block.id)}
      onFocusCapture={() => onInteract(block.id)}>
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
          type="button"
          className="opacity-0 group-hover:opacity-100 hover:cursor-move"
          aria-label="Drag to reorder block">
          <GripIcon className="size-4" />
        </button>
      </div>
      <div className="flex-1 rounded-r-lg border border-slate-200">
        <Collapsible.Root
          open={!isBlockCollapsed}
          onOpenChange={() => setIsBlockCollapsed(!isBlockCollapsed)}
          className={cn(isBlockCollapsed ? "h-full" : "")}>
          <Collapsible.CollapsibleTrigger asChild>
            <div className="block h-full w-full cursor-pointer hover:bg-slate-100">
              <div
                className="flex h-full items-center justify-between px-4 py-2"
                data-testid="block-card-header">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="group/name relative min-w-0">
                    <Input
                      ref={nameInputRef}
                      // Controlled: an auto-generated name is resequenced in place by a reorder,
                      // and an uncontrolled field would keep showing the number it mounted with.
                      value={block.name}
                      placeholder={t("workspace.surveys.edit.block_name")}
                      aria-label={t("workspace.surveys.edit.block_name")}
                      maxLength={BLOCK_NAME_MAX_LENGTH}
                      isInvalid={hasInvalidName}
                      onChange={(e) => updateBlockName(blockIdx, e.target.value)}
                      onKeyDown={handleNameKeyDown}
                      // The whole header row is the collapse trigger, so a click meant for the
                      // field would fold the block instead of placing the caret.
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        "-mx-2 h-6 w-full rounded-md border-transparent bg-transparent px-2 py-0",
                        // The placeholder is muted on purpose: a cleared name is an invalid state
                        // that must not look like a block still called something.
                        "text-sm font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400",
                        // Wide enough to type a real title into without the box clipping the text,
                        // and capped so a long one can't crowd out the block menu.
                        "max-w-[34rem] min-w-[20rem]",
                        // Dashed hover/focus box, matching the other inline renames in the app
                        // (see workflow-page-title.tsx): slate while hovered, brand while editing.
                        "border border-dashed transition-colors",
                        "hover:border-slate-300 focus:border-brand-dark",
                        // Same specificity means source order decides, and Tailwind emits hover
                        // last — without this the border drops to slate on a hovered focused field.
                        "focus:hover:border-brand-dark",
                        "focus:ring-0 focus:ring-offset-0 focus:outline-none"
                      )}
                    />
                    <PencilIcon
                      aria-hidden="true"
                      className="pointer-events-none absolute top-1 right-2 size-3.5 text-slate-400 opacity-0 transition-opacity group-focus-within/name:opacity-0 group-hover/name:opacity-100"
                    />
                    <p className="text-xs text-slate-500">
                      {t("common.count_questions", { count: block.elements.length })}
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
            <Tabs value={blockTab} onValueChange={setBlockTab} className="gap-0">
              <TabsList variant="underline" className="mx-4 mb-2 w-auto">
                <TabsTrigger value="questions" variant="underline" className="py-2">
                  {t("common.questions")}
                </TabsTrigger>
                <TabsTrigger value="settings" variant="underline" className="py-2">
                  {t("common.settings")}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="questions">
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
                      <div
                        key={element.id}
                        id={element.id}
                        className={cn("scroll-mt-16", elementIndex > 0 && "border-t border-slate-200")}>
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
                                        {t("workspace.surveys.edit.question_number", {
                                          number: elementIndex + 1,
                                        })}
                                      </p>
                                    )}
                                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                                      {getElementHeadline(element, selectedLanguageCode)}
                                      {codeIssues.has(element.id) && (
                                        <span
                                          role="img"
                                          aria-label={t("workspace.surveys.edit.code_needs_attention")}
                                          className="size-2 shrink-0 rounded-full bg-red-500"
                                        />
                                      )}
                                    </h3>
                                    {!isOpen && element.type !== TSurveyElementTypeEnum.CTA && (
                                      <p className="mt-1 truncate text-xs text-slate-500">
                                        {element?.required
                                          ? t("workspace.surveys.edit.required")
                                          : t("workspace.surveys.edit.optional")}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-x-2">
                                <EditorCardMenu
                                  survey={localSurvey}
                                  isTypeLocked={getElementLock(persistedSurvey, element.id).isTypeLocked}
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
                                  workspace={workspace}
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
                          <Collapsible.CollapsibleContent
                            className={`flex flex-col px-4 ${isOpen && "pb-4"}`}>
                            {shouldShowCautionAlert(element.type) && (
                              <Alert variant="warning" size="small" className="w-fill mt-2" role="status">
                                <AlertTitle>{t("workspace.surveys.edit.caution_text")}</AlertTitle>
                                <AlertButton onClick={() => onAlertTrigger()}>
                                  {t("common.learn_more")}
                                </AlertButton>
                              </Alert>
                            )}
                            <QuestionTabs
                              content={renderElementForm(element, elementIdx)}
                              hasSettingsIssue={codeIssues.has(element.id)}
                              settings={
                                <AdvancedSettings
                                  // TODO -- We should remove this when we can confirm that everything works fine with the survey editor, not changing this right now in this file because it would require changing the element type to the respective element type in all the element forms.
                                  element={element}
                                  elementIdx={elementIdx}
                                  localSurvey={localSurvey}
                                  lock={getElementLock(persistedSurvey, element.id)}
                                  updateElement={updateElement}
                                  updateBlockLogic={updateBlockLogic}
                                  updateBlockLogicFallback={updateBlockLogicFallback}
                                />
                              }
                            />
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
                    workspace={workspace}
                    isCxMode={isCxMode}
                  />
                </div>

                <hr className="border-dashed border-slate-200" />

                {/* Conditional Logic */}
                {block.elements[0] && (
                  <div className="p-4 pb-0">
                    <ConditionalLogic
                      localSurvey={localSurvey}
                      block={block}
                      blockIdx={blockIdx}
                      updateBlockLogic={updateBlockLogic}
                      updateBlockLogicFallback={updateBlockLogicFallback}
                      invalidElements={invalidElements}
                    />
                  </div>
                )}
              </TabsContent>
              <TabsContent value="settings">
                {/* Block Settings */}
                <div className="p-4">
                  <BlockSettings
                    localSurvey={localSurvey}
                    block={block}
                    blockIndex={blockIdx}
                    selectedLanguageCode={selectedLanguageCode}
                    updateBlockButtonLabel={updateBlockButtonLabel}
                    locale={locale}
                    isStorageConfigured={isStorageConfigured}
                    isLastBlock={blockIdx === totalBlocks - 1}
                    setLocalSurvey={setLocalSurvey}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </Collapsible.CollapsibleContent>
        </Collapsible.Root>
      </div>
    </div>
  );
};

// Skips re-rendering blocks the current edit cannot affect; see block-card-memo.ts for the rules.
export const BlockCard = memo(BlockCardComponent, areBlockCardPropsEqual);
