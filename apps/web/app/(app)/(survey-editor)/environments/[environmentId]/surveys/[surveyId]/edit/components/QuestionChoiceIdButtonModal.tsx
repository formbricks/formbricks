"use client";

import { ButtonModal } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/components/ButtonModal";
import { QuestionChoiceIdForm } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/components/QuestionChoiceIdForm";
import { PencilIcon } from "lucide-react";
import { TSurveyMultipleChoiceQuestion } from "@formbricks/types/surveys";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@formbricks/ui/Tooltip";

type QuestionChoiceIdButtonModalProps = {
  choice: {
    id: string;
    label: Record<string, string>;
  };
  choiceIdx: number;
  question: TSurveyMultipleChoiceQuestion;
  updateChoiceId: (choiceIdx: number, updatedAttributes: { id: string }) => void;
};

export const QuestionChoiceIdButtonModal: React.FC<QuestionChoiceIdButtonModalProps> = ({
  choice,
  choiceIdx,
  question,
  updateChoiceId,
}) => {
  return (
    <ButtonModal
      button={{
        children: (
          <>
            <TooltipProvider delayDuration={50}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center text-xs text-slate-500 ">
                    <PencilIcon className="h-4 w-4" />
                    ID
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-[300px]" side="top">
                  Set custom choice ID. Current: <b>{choice.id}</b>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        ),
        variant: "secondary",
        size: "sm",
      }}>
      {({ setOpen }) => {
        const otherChoiceIds = question.choices
          .filter((_, index) => index !== choiceIdx)
          .map((item) => item.id);

        return (
          <>
            <QuestionChoiceIdForm
              defaultValues={{ id: choice.id }}
              onSubmit={(data) => {
                console.log(">>> on submit data:", data);
                updateChoiceId(choiceIdx, data);
                setOpen(false);
              }}
              otherChoiceIds={otherChoiceIds}
            />
          </>
        );
      }}
    </ButtonModal>
  );
};
