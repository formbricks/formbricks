"use client";

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
import { createId } from "@paralleldrive/cuid2";
import { ArrowDownIcon, ArrowUpIcon, CopyIcon, EllipsisIcon, TrashIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  QUESTIONS_ICON_MAP,
  getCXQuestionNameMap,
  getQuestionDefaults,
  getQuestionNameMap,
} from "@formbricks/lib/utils/questions";
import { TProject } from "@formbricks/types/project";
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
  project?: TProject;
  isCxMode?: boolean;
  locale: string;
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
  locale,
}: EditorCardMenuProps) => {
  const t = useTranslations();
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

  const availableQuestionTypes = isCxMode ? getCXQuestionNameMap(locale) : getQuestionNameMap(locale);

  const changeQuestionType = (type?: TSurveyQuestionTypeEnum) => {
    if (!type) return;

    const { headline, required, subheader, imageUrl, videoUrl, buttonLabel, backButtonLabel } =
      card as TSurveyQuestion;

    const questionDefaults = getQuestionDefaults(type, project, locale);

    if (
      (type === TSurveyQuestionTypeEnum.MultipleChoiceSingle &&
        card.type === TSurveyQuestionTypeEnum.MultipleChoiceMulti) ||
      (type === TSurveyQuestionTypeEnum.MultipleChoiceMulti &&
        card.type === TSurveyQuestionTypeEnum.MultipleChoiceSingle)
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
    const questionDefaults = getQuestionDefaults(type, project, locale);

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
      <Button
        variant="minimal"
        size="icon"
        StartIcon={ArrowUpIcon}
        tooltip={t("common.move_up")}
        disabled={cardIdx === 0}
        onClick={(e) => {
          if (cardIdx !== 0) {
            e.stopPropagation();
            moveCard(cardIdx, true);
          }
        }}
        className="disabled:border-none"
      />
      <Button
        variant="minimal"
        size="icon"
        StartIcon={ArrowDownIcon}
        tooltip={t("common.move_down")}
        disabled={lastCard}
        onClick={(e) => {
          if (!lastCard) {
            e.stopPropagation();
            moveCard(cardIdx, false);
          }
        }}
        className="disabled:border-none"
      />
      <Button
        variant="minimal"
        size="icon"
        StartIcon={CopyIcon}
        tooltip={t("common.duplicate")}
        onClick={(e) => {
          e.stopPropagation();
          duplicateCard(cardIdx);
        }}
        className="disabled:border-none"
      />
      <Button
        variant="minimal"
        size="icon"
        StartIcon={TrashIcon}
        tooltip={t("common.delete")}
        disabled={isDeleteDisabled}
        onClick={(e) => {
          e.stopPropagation();
          if (isDeleteDisabled) return;
          deleteCard(cardIdx);
        }}
        className="disabled:border-none"
      />
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
