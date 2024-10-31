import { LogicEditorActions } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/components/LogicEditorActions";
import { LogicEditorConditions } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/components/LogicEditorConditions";
import { ArrowRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { TSurvey, TSurveyLogic, TSurveyQuestion } from "@formbricks/types/surveys/types";

interface LogicEditorProps {
  localSurvey: TSurvey;
  logicItem: TSurveyLogic;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  question: TSurveyQuestion;
  questionIdx: number;
  logicIdx: number;
  isLast: boolean;
}

export function LogicEditor({
  localSurvey,
  logicItem,
  updateQuestion,
  question,
  questionIdx,
  logicIdx,
  isLast,
}: LogicEditorProps) {
  const t = useTranslations();
  return (
    <div className="flex w-full grow flex-col gap-4 overflow-x-auto pb-2 text-sm">
      <LogicEditorConditions
        conditions={logicItem.conditions}
        updateQuestion={updateQuestion}
        question={question}
        questionIdx={questionIdx}
        localSurvey={localSurvey}
        logicIdx={logicIdx}
      />
      <LogicEditorActions
        logicItem={logicItem}
        logicIdx={logicIdx}
        question={question}
        updateQuestion={updateQuestion}
        localSurvey={localSurvey}
        questionIdx={questionIdx}
      />
      {isLast ? (
        <div className="flex flex-wrap items-center space-x-2">
          <ArrowRightIcon className="h-4 w-4" />
          <p className="text-slate-700">
            {t("environments.surveys.edit.all_other_answers_will_continue_to_the_next_question")}
          </p>
        </div>
      ) : null}
    </div>
  );
}
