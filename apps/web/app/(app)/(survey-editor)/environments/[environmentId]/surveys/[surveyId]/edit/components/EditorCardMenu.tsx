"use client";

import { createId } from "@paralleldrive/cuid2";
import { ArrowDownIcon, ArrowUpIcon, CopyIcon, EllipsisIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@formbricks/lib/cn";
import {
  CX_QUESTIONS_NAME_MAP,
  QUESTIONS_ICON_MAP,
  QUESTIONS_NAME_MAP,
  getQuestionDefaults,
} from "@formbricks/lib/utils/questions";
import { TProduct } from "@formbricks/types/product";
import {
  TSurvey,
  TSurveyEndScreenCard,
  TSurveyQuestion,
  TSurveyQuestionTypeEnum,
  TSurveyRedirectUrlCard,
} from "@formbricks/types/surveys/types";
import { ConfirmationModal } from "@formbricks/ui/components/ConfirmationModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@formbricks/ui/components/DropdownMenu";

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
  product?: TProduct;
  isCxMode?: boolean;
}

export const EditorCardMenu = ({
  survey,
  cardIdx,
  lastCard,
  duplicateCard,
  deleteCard,
  moveCard,
  product,
  card,
  updateCard,
  addCard,
  cardType,
  isCxMode = false,
}: EditorCardMenuProps) => {
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

  const availableQuestionTypes = isCxMode ? CX_QUESTIONS_NAME_MAP : QUESTIONS_NAME_MAP;

  const changeQuestionType = (type?: TSurveyQuestionTypeEnum) => {
    if (!type) return;

    const { headline, required, subheader, imageUrl, videoUrl, buttonLabel, backButtonLabel } =
      card as TSurveyQuestion;

    const questionDefaults = getQuestionDefaults(type, product);

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
    const questionDefaults = getQuestionDefaults(type, product);

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
    <div className="flex space-x-2">
      <CopyIcon
        className="h-4 cursor-pointer text-slate-500 hover:text-slate-600"
        onClick={(e) => {
          e.stopPropagation();
          duplicateCard(cardIdx);
        }}
      />
      <TrashIcon
        className={cn(
          "h-4 cursor-pointer text-slate-500",
          isDeleteDisabled ? "cursor-not-allowed opacity-50" : "hover:text-slate-600"
        )}
        onClick={(e) => {
          e.stopPropagation();
          if (isDeleteDisabled) return;
          deleteCard(cardIdx);
        }}
      />

      <DropdownMenu>
        <DropdownMenuTrigger>
          <EllipsisIcon className="h-4 w-4 text-slate-500 hover:text-slate-600" />
        </DropdownMenuTrigger>

        <DropdownMenuContent>
          <div className="flex flex-col">
            {cardType === "question" && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger
                  className="cursor-pointer text-sm text-slate-600 hover:text-slate-700"
                  onClick={(e) => e.preventDefault()}>
                  Change question type
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
                <span className="text-sm">Add ending below</span>
              </DropdownMenuItem>
            )}

            {cardType === "question" && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer" onClick={(e) => e.preventDefault()}>
                  Add question below
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
              <span>Move up</span>
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
              <span>Move down</span>
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmationModal
        open={logicWarningModal}
        setOpen={setLogicWarningModal}
        title="Changing will cause logic errors"
        text="Changing the question type will remove the logic conditions from this question"
        buttonText="Change anyway"
        onConfirm={onConfirm}
      />
    </div>
  );
};
