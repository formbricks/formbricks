"use client";

import { createId } from "@paralleldrive/cuid2";
import { Project } from "@prisma/client";
import { ArrowDownIcon, ArrowRightIcon, ArrowUpIcon, CopyIcon, EllipsisIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TI18nString } from "@formbricks/types/i18n";
import { TSurveyBlockLogic } from "@formbricks/types/surveys/blocks";
import { TSurveyElement, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey, TSurveyEndScreenCard, TSurveyRedirectUrlCard } from "@formbricks/types/surveys/types";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import {
  getCXElementNameMap,
  getElementDefaults,
  getElementIconMap,
  getElementNameMap,
} from "@/modules/survey/lib/elements";
import { Button } from "@/modules/ui/components/button";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  project?: Project;
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
  project,
  card,
  updateCard,
  addCard,
  addCardToBlock,
  moveElementToBlock,
  cardType,
  isCxMode = false,
}: EditorCardMenuProps) => {
  const { t } = useTranslation();
  const ELEMENTS_ICON_MAP = getElementIconMap(t);
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

  const availableElementTypes = isCxMode ? getCXElementNameMap(t) : getElementNameMap(t);

  const changeElementType = (type?: TSurveyElementTypeEnum) => {
    if (!type) return;

    const { headline, required, subheader, imageUrl, videoUrl, buttonLabel, backButtonLabel } =
      card as EditorCardMenuSurveyElement;

    const elementDefaults = getElementDefaults(type, project, t);

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
    });
  };

  const addElementCardBelow = (type: TSurveyElementTypeEnum) => {
    const elementDefaults = getElementDefaults(type, project, t);

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

    const section = document.getElementById(`${card.id}`);
    section?.scrollIntoView({ behavior: "smooth", block: "end", inline: "end" });
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
        tooltipContent={t("environments.surveys.edit.duplicate_question")}
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
        <DropdownMenuTrigger className="h-10 w-10 rounded-lg border border-transparent p-2 hover:border-slate-200">
          <EllipsisIcon className="mx-auto h-4 w-4 text-slate-700 hover:text-slate-600" />
        </DropdownMenuTrigger>

        <DropdownMenuContent>
          <div className="flex flex-col">
            {cardType === "element" && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger
                  className="cursor-pointer text-sm text-slate-600 hover:text-slate-700"
                  onClick={(e) => e.preventDefault()}>
                  {t("environments.surveys.edit.change_question_type")}
                </DropdownMenuSubTrigger>

                <DropdownMenuSubContent className="ml-2">
                  {Object.entries(availableElementTypes).map(([type, name]) => {
                    if (type === card.type) return null;
                    return (
                      <DropdownMenuItem
                        key={type}
                        onClick={() => {
                          setChangeToType(type as TSurveyElementTypeEnum);
                          if ((card as EditorCardMenuSurveyElement).logic) {
                            setLogicWarningModal(true);
                            return;
                          }

                          changeElementType(type as TSurveyElementTypeEnum);
                        }}
                        icon={ELEMENTS_ICON_MAP[type as TSurveyElementTypeEnum]}>
                        <span className="ml-2">{name}</span>
                      </DropdownMenuItem>
                    );
                  })}
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
                <span className="text-sm">{t("environments.surveys.edit.add_ending_below")}</span>
              </DropdownMenuItem>
            )}

            {cardType === "element" && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer" onClick={(e) => e.preventDefault()}>
                  {t("environments.surveys.edit.add_question_below")}
                </DropdownMenuSubTrigger>

                <DropdownMenuSubContent className="ml-2">
                  {Object.entries(availableElementTypes).map(([type, name]) => {
                    return (
                      <DropdownMenuItem
                        key={type}
                        className="min-h-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (cardType === "element") {
                            addElementCardBelow(type as TSurveyElementTypeEnum);
                          }
                        }}>
                        {ELEMENTS_ICON_MAP[type as TSurveyElementTypeEnum]}
                        <span className="ml-2">{name}</span>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
            {cardType === "element" && moveElementToBlock && survey.blocks.length > 1 && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer" onClick={(e) => e.preventDefault()}>
                  {t("environments.surveys.edit.move_question_to_block")}
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
                        icon={<ArrowRightIcon className="h-4 w-4" />}>
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
              icon={<ArrowUpIcon className="h-4 w-4" />}
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
              icon={<ArrowDownIcon className="h-4 w-4" />}
              disabled={lastCard}>
              <span>{t("common.move_down")}</span>
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmationModal
        open={logicWarningModal}
        setOpen={setLogicWarningModal}
        title={t("environments.surveys.edit.logic_error_warning")}
        body={t("environments.surveys.edit.logic_error_warning_text")}
        buttonText={t("environments.surveys.edit.change_anyway")}
        onConfirm={onConfirm}
      />
    </div>
  );
};
