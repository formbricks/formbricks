import { AdvancedLogicEditorActions } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/components/AdvancedLogicEditorActions";
import { AdvancedLogicEditorConditions } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/components/AdvancedLogicEditorConditions";
import { TSurveyAdvancedLogic } from "@formbricks/types/surveys/logic";
import { TSurvey, TSurveyQuestion } from "@formbricks/types/surveys/types";

interface AdvancedLogicEditorProps {
  localSurvey: TSurvey;
  logicItem: TSurveyAdvancedLogic;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  question: TSurveyQuestion;
  questionIdx: number;
  logicIdx: number;
  userAttributes: string[];
}

export function AdvancedLogicEditor({
  localSurvey,
  logicItem,
  updateQuestion,
  question,
  questionIdx,
  logicIdx,
  userAttributes,
}: AdvancedLogicEditorProps) {
  return (
    <div className="flex w-full flex-col gap-4 overflow-auto rounded-lg border border-slate-200 bg-slate-100 p-4">
      <AdvancedLogicEditorConditions
        conditions={logicItem.conditions}
        updateQuestion={updateQuestion}
        question={question}
        questionIdx={questionIdx}
        localSurvey={localSurvey}
        logicIdx={logicIdx}
        userAttributes={userAttributes}
      />
      <AdvancedLogicEditorActions
        logicItem={logicItem}
        logicIdx={logicIdx}
        question={question}
        updateQuestion={updateQuestion}
        localSurvey={localSurvey}
        userAttributes={userAttributes}
        questionIdx={questionIdx}
      />
    </div>
  );
}
