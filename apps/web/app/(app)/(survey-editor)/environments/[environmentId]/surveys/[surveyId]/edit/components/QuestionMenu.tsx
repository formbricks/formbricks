"use client";

import { QUESTIONS_ICON_MAP, QUESTIONS_NAME_MAP, getQuestionDefaults } from "@/app/lib/questions";
import { createId } from "@paralleldrive/cuid2";
import { ArrowDownIcon, ArrowUpIcon, CopyIcon, EllipsisIcon, TrashIcon } from "lucide-react";
import React, { useState } from "react";

import { TProduct } from "@formbricks/types/product";
import { TSurveyQuestion, TSurveyQuestionType } from "@formbricks/types/surveys/types";
import { ConfirmationModal } from "@formbricks/ui/ConfirmationModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@formbricks/ui/DropdownMenu";

interface QuestionDropdownProps {
  questionIdx: number;
  lastQuestion: boolean;
  duplicateQuestion: (questionIdx: number) => void;
  deleteQuestion: (questionIdx: number) => void;
  moveQuestion: (questionIdx: number, up: boolean) => void;
  question: TSurveyQuestion;
  product: TProduct;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  addQuestion: (question: any, index?: number) => void;
}

export const QuestionMenu = ({
  questionIdx,
  lastQuestion,
  duplicateQuestion,
  deleteQuestion,
  moveQuestion,
  product,
  question,
  updateQuestion,
  addQuestion,
}: QuestionDropdownProps) => {
  const [logicWarningModal, setLogicWarningModal] = useState(false);
  const [changeToType, setChangeToType] = useState(question.type);

  const changeQuestionType = (type: TSurveyQuestionType) => {
    const { headline, required, subheader, imageUrl, videoUrl, buttonLabel, backButtonLabel } = question;

    const questionDefaults = getQuestionDefaults(type, product);

    // if going from single select to multi select or vice versa, we need to keep the choices as well

    if (
      (type === TSurveyQuestionType.MultipleChoiceSingle &&
        question.type === TSurveyQuestionType.MultipleChoiceMulti) ||
      (type === TSurveyQuestionType.MultipleChoiceMulti &&
        question.type === TSurveyQuestionType.MultipleChoiceSingle)
    ) {
      updateQuestion(questionIdx, {
        choices: question.choices,
        type,
        logic: undefined,
      });

      return;
    }

    updateQuestion(questionIdx, {
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

  const addQuestionBelow = (type: TSurveyQuestionType) => {
    const questionDefaults = getQuestionDefaults(type, product);

    addQuestion(
      {
        ...questionDefaults,
        type,
        id: createId(),
        required: true,
      },
      questionIdx + 1
    );

    // scroll to the new question
    const section = document.getElementById(`${question.id}`);
    section?.scrollIntoView({ behavior: "smooth", block: "end", inline: "end" });
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
          duplicateQuestion(questionIdx);
        }}
      />
      <TrashIcon
        className="h-4 cursor-pointer text-slate-500 hover:text-slate-600"
        onClick={(e) => {
          e.stopPropagation();
          deleteQuestion(questionIdx);
        }}
      />

      <DropdownMenu>
        <DropdownMenuTrigger>
          <EllipsisIcon className="h-4 w-4 text-slate-500 hover:text-slate-600" />
        </DropdownMenuTrigger>

        <DropdownMenuContent>
          <div className="flex flex-col">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <div className="cursor-pointer text-slate-500 hover:text-slate-600">
                  <span className="text-xs text-slate-500">Change question type</span>
                </div>
              </DropdownMenuSubTrigger>

              <DropdownMenuSubContent className="ml-4 border border-slate-200">
                {Object.entries(QUESTIONS_NAME_MAP).map(([type, name]) => {
                  if (type === question.type) return null;

                  return (
                    <DropdownMenuItem
                      key={type}
                      className="min-h-8 cursor-pointer text-slate-500"
                      onClick={() => {
                        setChangeToType(type as TSurveyQuestionType);
                        if (question.logic) {
                          setLogicWarningModal(true);
                          return;
                        }

                        changeQuestionType(type as TSurveyQuestionType);
                      }}>
                      {QUESTIONS_ICON_MAP[type as TSurveyQuestionType]}
                      <span className="ml-2">{name}</span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <div className="cursor-pointer text-slate-500 hover:text-slate-600">
                  <span className="text-xs text-slate-500">Add question below</span>
                </div>
              </DropdownMenuSubTrigger>

              <DropdownMenuSubContent className="ml-4 border border-slate-200">
                {Object.entries(QUESTIONS_NAME_MAP).map(([type, name]) => {
                  if (type === question.type) return null;

                  return (
                    <DropdownMenuItem
                      key={type}
                      className="min-h-8 cursor-pointer text-slate-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        addQuestionBelow(type as TSurveyQuestionType);
                      }}>
                      {QUESTIONS_ICON_MAP[type as TSurveyQuestionType]}
                      <span className="ml-2">{name}</span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem
              className={`flex min-h-8 cursor-pointer justify-between text-slate-500 hover:text-slate-600 ${
                questionIdx === 0 ? "opacity-50" : ""
              }`}
              onClick={(e) => {
                if (questionIdx !== 0) {
                  e.stopPropagation();
                  moveQuestion(questionIdx, true);
                }
              }}
              disabled={questionIdx === 0}>
              <span className="text-xs text-slate-500">Move up</span>
              <ArrowUpIcon className="h-4 w-4" />
            </DropdownMenuItem>

            <DropdownMenuItem
              className={`flex min-h-8 cursor-pointer justify-between text-slate-500 hover:text-slate-600 ${
                lastQuestion ? "opacity-50" : ""
              }`}
              onClick={(e) => {
                if (!lastQuestion) {
                  e.stopPropagation();
                  moveQuestion(questionIdx, false);
                }
              }}
              disabled={lastQuestion}>
              <span className="text-xs text-slate-500">Move down</span>
              <ArrowDownIcon className="h-4 w-4" />
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
        buttonVariant="darkCTA"
      />
    </div>
  );
};
