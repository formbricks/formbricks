"use client";

import { createId } from "@paralleldrive/cuid2";
import { ArrowDownIcon, ArrowRightIcon, ArrowUpIcon, CopyIcon, EllipsisIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Workspace } from "@formbricks/database/prisma-browser";
import { TI18nString } from "@formbricks/types/i18n";
import { TSurveyBlockLogic } from "@formbricks/types/surveys/blocks";
import { TSurveyElement, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey, TSurveyEndScreenCard, TSurveyRedirectUrlCard } from "@formbricks/types/surveys/types";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import { getElementDefaults, getGroupedElementTypes } from "@/modules/survey/lib/elements";
import { Button } from "@/modules/ui/components/button";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

type EditorCardMenuSurveyElement = TSurveyElement & {
  logic?: TSurveyBlockLogic[];
  buttonLabel?: TI18nString;
  backButtonLabel?: TI18nString;
};

interface EditorCardMenuProps {
  survey: TSurvey;
  cardIdx: number;
  lastCard: boolean;
  blockId?: string;
  elementIdx?: number; // Index of element within its block
  duplicateCard: (cardIdx: number) => void;
  deleteCard: (cardIdx: number) => void;
  moveCard: (cardIdx: number, up: boolean) => void;
  card: EditorCardMenuSurveyElement | TSurveyEndScreenCard | TSurveyRedirectUrlCard;
  updateCard: (cardIdx: number, updatedAttributes: any) => void;
  addCard: (element: any, index?: number) => void;
  addCardToBlock?: (element: TSurveyElement, blockId: string, afterElementIdx: number) => void;
  moveElementToBlock?: (elementId: string, targetBlockId: string) => void;
  cardType: "element" | "ending";
  workspace?: Workspace;
  isCxMode?: boolean;
}

export const EditorCardMenu = ({
  survey,
  cardIdx,
  lastCard,
  blockId,
  elementIdx,
  duplicateCard,
  deleteCard,
  moveCard,
  workspace,
  card,
  updateCard,
  addCard,
  addCardToBlock,
  moveElementToBlock,
  cardType,
  isCxMode = false,
}: EditorCardMenuProps) => {
  const { t } = useTranslation();
  const [logicWarningModal, setLogicWarningModal] = useState(false);
  const [changeToType, setChangeToType] = useState(() => {
    if (card.type !== "endScreen" && card.type !== "redirectToUrl") {
      return card.type;
    }

    return undefined;
  });

  const elements = getElementsFromBlocks(survey.blocks);
  const isDeleteDisabled =
    cardType === "element" ? elements.length === 1 : survey.type === "link" && survey.endings.length === 1;

  const groupedElementTypes = getGroupedElementTypes(t, isCxMode);

  const changeElementType = (type?: TSurveyElementTypeEnum) => {
    if (!type) return;

    const { headline, required, subheader, imageUrl, videoUrl, buttonLabel, backButtonLabel } =
      card as EditorCardMenuSurveyElement;

    const elementDefaults = getElementDefaults(type, workspace, t);

    if (
      (type === TSurveyElementTypeEnum.MultipleChoiceSingle &&
        card.type === TSurveyElementTypeEnum.MultipleChoiceMulti) ||
      (type === TSurveyElementTypeEnum.MultipleChoiceMulti &&
        card.type === TSurveyElementTypeEnum.MultipleChoiceSingle) ||
      (type === TSurveyElementTypeEnum.MultipleChoiceMulti && card.type === TSurveyElementTypeEnum.Ranking) ||
      (type === TSurveyElementTypeEnum.Ranking && card.type === TSurveyElementTypeEnum.MultipleChoiceMulti) ||
      (type === TSurveyElementTypeEnum.MultipleChoiceSingle &&
        card.type === TSurveyElementTypeEnum.Ranking) ||
      (type === TSurveyElementTypeEnum.Ranking && card.type === TSurveyElementTypeEnum.MultipleChoiceSingle)
    ) {
      updateCard(cardIdx, {
        choices: card.choices,
        type,
        logic: undefined,
        validation: undefined,
      });

      return;
    }

    updateCard(cardIdx, {
      ...elementDefaults,
      type,
      headline,
      subheader,
      required: type === TSurveyElementTypeEnum.CTA ? false : required,
      imageUrl,
      videoUrl,
      buttonLabel,
      backButtonLabel,
      logic: undefined,
      validation: undefined,
    });
  };

  const addElementCardBelow = (type: TSurveyElementTypeEnum) => {
    const elementDefaults = getElementDefaults(type, workspace, t);

    const newElement = {
      ...elementDefaults,
      type,
      id: createId(),
      required: type === TSurveyElementTypeEnum.CTA ? false : true,
    };

    // Add element to block or as new block
    if (addCardToBlock && blockId && elementIdx !== undefined) {
      // Pass blockId and element index within the block
      addCardToBlock(newElement as TSurveyElement, blockId, elementIdx);
    } else {
      addCard(newElement, cardIdx + 1);
    }
  };

  const addEndingCardBelow = () => {
    addCard(cardIdx + 1);
  };

  const onConfirm = () => {
    changeElementType(changeToType);
    setLogicWarningModal(false);
  };

  return (
    <div className="flex">
      <TooltipRenderer tooltipContent={t("common.move_up")}>
        <Button
          variant="ghost"
          size="icon"
          disabled={cardIdx === 0}
          onClick={(e) => {
            if (cardIdx !== 0) {
              e.stopPropagation();
              moveCard(cardIdx, true);
            }
          }}
          className="disabled:border-none">
          <ArrowUpIcon />
        </Button>
      </TooltipRenderer>
      <TooltipRenderer tooltipContent={t("common.move_down")} triggerClass="disabled:border-none">
        <Button
          variant="ghost"
          size="icon"
          disabled={lastCard}
          onClick={(e) => {
            if (!lastCard) {
              e.stopPropagation();
              moveCard(cardIdx, false);
            }
          }}
          className="disabled:border-none">
          <ArrowDownIcon />
        </Button>
      </TooltipRenderer>
      <TooltipRenderer
        tooltipContent={t("workspace.surveys.edit.duplicate_question")}
        triggerClass="disabled:border-none">
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            duplicateCard(cardIdx);
          }}
          className="disabled:border-none">
          <CopyIcon />
        </Button>
      </TooltipRenderer>
      <TooltipRenderer tooltipContent={t("common.delete")} triggerClass="disabled:border-none">
        <Button
          variant="ghost"
          size="icon"
          disabled={isDeleteDisabled}
          onClick={(e) => {
            e.stopPropagation();
            if (isDeleteDisabled) return;
            deleteCard(cardIdx);
          }}
          className="disabled:border-none">
          <TrashIcon />
        </Button>
      </TooltipRenderer>
      <DropdownMenu>
        <DropdownMenuTrigger className="size-10 rounded-lg border border-transparent p-2 hover:border-slate-200">
          <EllipsisIcon className="mx-auto size-4 text-slate-700 hover:text-slate-600" />
        </DropdownMenuTrigger>

        <DropdownMenuContent>
          <div className="flex flex-col">
            {cardType === "element" && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger
                  className="cursor-pointer text-sm text-slate-600 hover:text-slate-700"
                  onClick={(e) => e.preventDefault()}>
                  {t("workspace.surveys.edit.change_question_type")}
                </DropdownMenuSubTrigger>

                <DropdownMenuSubContent className="ml-2">
                  {groupedElementTypes
                    .map((group) => ({
                      ...group,
                      elements: group.elements.filter((elementType) => elementType.id !== card.type),
                    }))
                    .filter((group) => group.elements.length > 0)
                    .map((group, index) => (
                      <div key={group.category.id}>
                        {index > 0 && <DropdownMenuSeparator />}
                        <DropdownMenuLabel className="pt-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                          {group.category.label}
                        </DropdownMenuLabel>
                        {group.elements.map((elementType) => (
                          <DropdownMenuItem
                            key={elementType.id}
                            onClick={() => {
                              setChangeToType(elementType.id as TSurveyElementTypeEnum);
                              if ((card as EditorCardMenuSurveyElement).logic) {
                                setLogicWarningModal(true);
                                return;
                              }

                              changeElementType(elementType.id as TSurveyElementTypeEnum);
                            }}
                            icon={<elementType.icon className="size-4" />}>
                            <span className="ml-2">{elementType.label}</span>
                          </DropdownMenuItem>
                        ))}
                      </div>
                    ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
            {cardType === "ending" && (
              <DropdownMenuItem
                className="min-h-8 justify-between"
                onClick={(e) => {
                  e.preventDefault();
                  addEndingCardBelow();
                }}>
                <span className="text-sm">{t("workspace.surveys.edit.add_ending_below")}</span>
              </DropdownMenuItem>
            )}

            {cardType === "element" && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer" onClick={(e) => e.preventDefault()}>
                  {t("workspace.surveys.edit.add_question_below")}
                </DropdownMenuSubTrigger>

                <DropdownMenuSubContent className="ml-2">
                  {groupedElementTypes.map((group, index) => (
                    <div key={group.category.id}>
                      {index > 0 && <DropdownMenuSeparator />}
                      <DropdownMenuLabel className="pt-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                        {group.category.label}
                      </DropdownMenuLabel>
                      {group.elements.map((elementType) => (
                        <DropdownMenuItem
                          key={elementType.id}
                          className="min-h-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (cardType === "element") {
                              addElementCardBelow(elementType.id as TSurveyElementTypeEnum);
                            }
                          }}>
                          <elementType.icon className="size-4" />
                          <span className="ml-2">{elementType.label}</span>
                        </DropdownMenuItem>
                      ))}
                    </div>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
            {cardType === "element" && moveElementToBlock && survey.blocks.length > 1 && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer" onClick={(e) => e.preventDefault()}>
                  {t("workspace.surveys.edit.move_question_to_block")}
                </DropdownMenuSubTrigger>

                <DropdownMenuSubContent className="ml-2">
                  {survey.blocks.map((block) => {
                    // Don't show current block in the list
                    if (block.id === blockId) return null;

                    const blockName = block.name;
                    return (
                      <DropdownMenuItem
                        key={block.id}
                        className="min-h-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveElementToBlock(card.id, block.id);
                        }}
                        icon={<ArrowRightIcon className="size-4" />}>
                        <span className="ml-2">{blockName}</span>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
            <DropdownMenuItem
              onClick={(e) => {
                if (cardIdx !== 0) {
                  e.stopPropagation();
                  moveCard(cardIdx, true);
                }
              }}
              icon={<ArrowUpIcon className="size-4" />}
              disabled={cardIdx === 0}>
              <span>{t("common.move_up")}</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={(e) => {
                if (!lastCard) {
                  e.stopPropagation();
                  moveCard(cardIdx, false);
                }
              }}
              icon={<ArrowDownIcon className="size-4" />}
              disabled={lastCard}>
              <span>{t("common.move_down")}</span>
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmationModal
        open={logicWarningModal}
        setOpen={setLogicWarningModal}
        title={t("workspace.surveys.edit.logic_error_warning")}
        body={t("workspace.surveys.edit.logic_error_warning_text")}
        buttonText={t("workspace.surveys.edit.change_anyway")}
        onConfirm={onConfirm}
      />
    </div>
  );
};
