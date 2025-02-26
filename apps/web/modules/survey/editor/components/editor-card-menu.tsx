"use client";

import {
  getCXQuestionNameMap,
  getQuestionDefaults,
  getQuestionIconMap,
  getQuestionNameMap,
} from "@/modules/survey/editor/lib/questions";
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
import { createId } from "@paralleldrive/cuid2";
import { Project } from "@prisma/client";
import { useTranslate } from "@tolgee/react";
import { ArrowDownIcon, ArrowUpIcon, CopyIcon, EllipsisIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import {
  TSurvey,
  TSurveyEndScreenCard,
  TSurveyQuestion,
  TSurveyQuestionTypeEnum,
  TSurveyRedirectUrlCard,
} from "@formbricks/types/surveys/types";

interface EditorCardMenuProps {
  survey: TSurvey;
  cardIdx: number;
  lastCard: boolean;
  duplicateCard: (cardIdx: number) => void;
  deleteCard: (cardIdx: number) => void;
  moveCard: (cardIdx: number, up: boolean) => void;
  card: TSurveyQuestion | TSurveyEndScreenCard | TSurveyRedirectUrlCard;
  updateCard: (cardIdx: number, updatedAttributes: any) => void;
  addCard: (question: any, index?: number) => void;
  cardType: "question" | "ending";
  project?: Project;
  isCxMode?: boolean;
}

export const EditorCardMenu = ({
  survey,
  cardIdx,
  lastCard,
  duplicateCard,
  deleteCard,
  moveCard,
  project,
  card,
  updateCard,
  addCard,
  cardType,
  isCxMode = false,
}: EditorCardMenuProps) => {
  const { t } = useTranslate();
  const QUESTIONS_ICON_MAP = getQuestionIconMap(t);
  const [logicWarningModal, setLogicWarningModal] = useState(false);
  const [changeToType, setChangeToType] = useState(() => {
    if (card.type !== "endScreen" && card.type !== "redirectToUrl") {
      return card.type;
    }

    return undefined;
  });
  const isDeleteDisabled =
    cardType === "question"
      ? survey.questions.length === 1
      : survey.type === "link" && survey.endings.length === 1;

  const availableQuestionTypes = isCxMode ? getCXQuestionNameMap(t) : getQuestionNameMap(t);

  const changeQuestionType = (type?: TSurveyQuestionTypeEnum) => {
    if (!type) return;

    const { headline, required, subheader, imageUrl, videoUrl, buttonLabel, backButtonLabel } =
      card as TSurveyQuestion;

    const questionDefaults = getQuestionDefaults(type, project, t);

    if (
      (type === TSurveyQuestionTypeEnum.MultipleChoiceSingle &&
        card.type === TSurveyQuestionTypeEnum.MultipleChoiceMulti) ||
      (type === TSurveyQuestionTypeEnum.MultipleChoiceMulti &&
        card.type === TSurveyQuestionTypeEnum.MultipleChoiceSingle) ||
      (type === TSurveyQuestionTypeEnum.MultipleChoiceMulti &&
        card.type === TSurveyQuestionTypeEnum.Ranking) ||
      (type === TSurveyQuestionTypeEnum.Ranking &&
        card.type === TSurveyQuestionTypeEnum.MultipleChoiceMulti) ||
      (type === TSurveyQuestionTypeEnum.MultipleChoiceSingle &&
        card.type === TSurveyQuestionTypeEnum.Ranking) ||
      (type === TSurveyQuestionTypeEnum.Ranking && card.type === TSurveyQuestionTypeEnum.MultipleChoiceSingle)
    ) {
      updateCard(cardIdx, {
        choices: card.choices,
        type,
        logic: undefined,
      });

      return;
    }

    updateCard(cardIdx, {
      ...questionDefaults,
      type,
      headline,
      subheader,
      required,
      imageUrl,
      videoUrl,
      buttonLabel,
      backButtonLabel,
      logic: undefined,
    });
  };

  const addQuestionCardBelow = (type: TSurveyQuestionTypeEnum) => {
    const questionDefaults = getQuestionDefaults(type, project, t);

    addCard(
      {
        ...questionDefaults,
        type,
        id: createId(),
        required: true,
      },
      cardIdx + 1
    );

    const section = document.getElementById(`${card.id}`);
    section?.scrollIntoView({ behavior: "smooth", block: "end", inline: "end" });
  };

  const addEndingCardBelow = () => {
    addCard(cardIdx + 1);
  };

  const onConfirm = () => {
    changeQuestionType(changeToType);
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
      <TooltipRenderer tooltipContent={t("common.duplicate")} triggerClass="disabled:border-none">
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
            {cardType === "question" && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger
                  className="cursor-pointer text-sm text-slate-600 hover:text-slate-700"
                  onClick={(e) => e.preventDefault()}>
                  {t("environments.surveys.edit.change_question_type")}
                </DropdownMenuSubTrigger>

                <DropdownMenuSubContent className="ml-2">
                  {Object.entries(availableQuestionTypes).map(([type, name]) => {
                    if (type === card.type) return null;
                    return (
                      <DropdownMenuItem
                        key={type}
                        onClick={() => {
                          setChangeToType(type as TSurveyQuestionTypeEnum);
                          if ((card as TSurveyQuestion).logic) {
                            setLogicWarningModal(true);
                            return;
                          }

                          changeQuestionType(type as TSurveyQuestionTypeEnum);
                        }}
                        icon={QUESTIONS_ICON_MAP[type as TSurveyQuestionTypeEnum]}>
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

            {cardType === "question" && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer" onClick={(e) => e.preventDefault()}>
                  {t("environments.surveys.edit.add_question_below")}
                </DropdownMenuSubTrigger>

                <DropdownMenuSubContent className="ml-2">
                  {Object.entries(availableQuestionTypes).map(([type, name]) => {
                    return (
                      <DropdownMenuItem
                        key={type}
                        className="min-h-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (cardType === "question") {
                            addQuestionCardBelow(type as TSurveyQuestionTypeEnum);
                          }
                        }}>
                        {QUESTIONS_ICON_MAP[type as TSurveyQuestionTypeEnum]}
                        <span className="ml-2">{name}</span>
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
        text={t("environments.surveys.edit.logic_error_warning_text")}
        buttonText={t("environments.surveys.edit.change_anyway")}
        onConfirm={onConfirm}
      />
    </div>
  );
};
