"use client";

import { getQuestionDefaults } from "@/app/lib/questions";
import { QUESTIONS_ICON_MAP, QUESTIONS_NAME_MAP } from "@/app/lib/surveys/constants";
import { RectangleEllipsisIcon } from "lucide-react";
import { useState } from "react";

import { structuredClone } from "@formbricks/lib/pollyfills/structuredClone";
import { TProduct } from "@formbricks/types/product";
import { TSurvey, TSurveyQuestion, TSurveyQuestionType } from "@formbricks/types/surveys";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@formbricks/ui/DropdownMenu";
import { Modal } from "@formbricks/ui/Modal";
import "@formbricks/ui/Select";

interface QuestionCardIconProps {
  question: TSurveyQuestion;
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
  product: TProduct;
}

export const QuestionCardIcon = ({
  question,
  localSurvey,
  setLocalSurvey,
  product,
}: QuestionCardIconProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [dropdownMenuOpen, setDropdownMenuOpen] = useState(false);
  const [logicWarningModal, setLogicWarningModal] = useState(false);

  const IconComponent = (props: React.ComponentProps<"div">) => {
    return <div {...props}>{QUESTIONS_ICON_MAP[question.type]}</div>;
  };

  const changeQuestionType = (type: TSurveyQuestionType) => {
    const { questions } = localSurvey;

    const updatedQuestions = questions.map((ques) => {
      if (ques.id === question.id) {
        // common properties for all questions
        const { headline, required, id, subheader, imageUrl, videoUrl, buttonLabel, backButtonLabel } =
          question;

        const questionDefaults = getQuestionDefaults(type, product);

        // if the question is a CTA or Consent question, we need to check if the html property is present
        // if the html property is present, we need to copy the subheader property to the html property
        // and remove the subheader property

        // when going from CTA to Consent or vice versa, we need to check if the html property is present
        // if the html property is present, we need to copy the html property

        if (type === TSurveyQuestionType.CTA && question.type === TSurveyQuestionType.Consent) {
          const { html } = questionDefaults;

          if (html) {
            return {
              ...questionDefaults,
              type,
              headline,
              html,
              required,
              id,
              imageUrl,
              videoUrl,
              buttonLabel,
              backButtonLabel,
            };
          }
        }

        if (type === TSurveyQuestionType.CTA || type === TSurveyQuestionType.Consent) {
          const { html } = questionDefaults;

          if (html) {
            return {
              ...questionDefaults,
              type,
              headline,
              ...(subheader ? { html: subheader } : { html }),
              required,
              id,
              imageUrl,
              videoUrl,
              buttonLabel,
              backButtonLabel,
            };
          }
        }

        return {
          ...questionDefaults,
          type,
          headline,
          subheader,
          required,
          id,
          imageUrl,
          videoUrl,
          buttonLabel,
          backButtonLabel,
        };
      }

      return ques;
    });

    const localSurveyClone = structuredClone(localSurvey);
    // @ts-expect-error
    localSurveyClone.questions = updatedQuestions;
    setLocalSurvey(localSurveyClone);
  };

  return (
    <>
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          if (dropdownMenuOpen) {
            return;
          }

          setIsHovered(false);
        }}
        onClick={(e) => e.preventDefault()}
        className="relative cursor-pointer">
        {isHovered ? (
          <div>
            <DropdownMenu
              open={dropdownMenuOpen}
              onOpenChange={(isOpen) => {
                setDropdownMenuOpen(isOpen);
                setIsHovered(isOpen);
              }}>
              <DropdownMenuTrigger
                asChild
                className="cursor-pointer"
                onClick={() => {
                  setIsHovered(false);
                  setDropdownMenuOpen(true);
                }}>
                <RectangleEllipsisIcon className="h-5 w-5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="ml-4 border border-slate-200">
                <DropdownMenuLabel className="text-xs text-slate-500">Change question type</DropdownMenuLabel>
                <DropdownMenuSeparator />

                {Object.entries(QUESTIONS_NAME_MAP).map(([type, name]) => (
                  <DropdownMenuItem
                    key={type}
                    className="min-h-8 cursor-pointer"
                    onClick={() => {
                      if (question.logic) {
                        setLogicWarningModal(true);
                        return;
                      }

                      changeQuestionType(type as TSurveyQuestionType);
                      setDropdownMenuOpen(false);
                    }}>
                    {QUESTIONS_ICON_MAP[type as TSurveyQuestionType]}
                    <span className="ml-2">{name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <IconComponent />
        )}
      </div>

      <Modal open={logicWarningModal} setOpen={setLogicWarningModal}>
        Logic exists
      </Modal>
    </>
  );
};
