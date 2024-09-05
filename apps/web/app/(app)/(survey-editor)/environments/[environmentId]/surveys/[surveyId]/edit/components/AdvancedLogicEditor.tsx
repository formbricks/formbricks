import { AdvancedLogicEditorActions } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/components/AdvancedLogicEditorActions";
import { AdvancedLogicEditorConditions } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/components/AdvancedLogicEditorConditions";
import { ArrowRightIcon } from "lucide-react";
import { cn } from "@formbricks/lib/cn";
import { TSurveyAdvancedLogic } from "@formbricks/types/surveys/logic";
import { TSurvey, TSurveyQuestion } from "@formbricks/types/surveys/types";

interface AdvancedLogicEditorProps {
  localSurvey: TSurvey;
  logicItem: TSurveyAdvancedLogic;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  question: TSurveyQuestion;
  questionIdx: number;
  logicIdx: number;
  isLast: boolean;
}

export function AdvancedLogicEditor({
  localSurvey,
  logicItem,
  updateQuestion,
  question,
  questionIdx,
  logicIdx,
  isLast,
}: AdvancedLogicEditorProps) {
  return (
    <div className={cn("flex w-full grow flex-col gap-4 text-sm")}>
      <AdvancedLogicEditorConditions
        conditions={logicItem.conditions}
        updateQuestion={updateQuestion}
        question={question}
        questionIdx={questionIdx}
        localSurvey={localSurvey}
        logicIdx={logicIdx}
      />
      <AdvancedLogicEditorActions
        logicItem={logicItem}
        logicIdx={logicIdx}
        question={question}
        updateQuestion={updateQuestion}
        localSurvey={localSurvey}
        questionIdx={questionIdx}
      />
      {isLast && (
        <div className="flex flex-wrap items-center space-x-2">
          <ArrowRightIcon className="h-4 w-4" />
          <p className="text-slate-700">All other answers will continue to the next question</p>
        </div>
      )}
    </div>
  );
}
