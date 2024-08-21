import { AdvancedLogicEditor } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/components/AdvancedLogicEditor";
import { createId } from "@paralleldrive/cuid2";
import { ArrowRightIcon, SplitIcon, Trash2Icon } from "lucide-react";
import { cn } from "@formbricks/lib/cn";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TSurvey, TSurveyQuestion } from "@formbricks/types/surveys/types";
import { Button } from "@formbricks/ui/Button";
import { Label } from "@formbricks/ui/Label";

interface ConditionalLogicProps {
  localSurvey: TSurvey;
  questionIdx: number;
  question: TSurveyQuestion;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  attributeClasses: TAttributeClass[];
}

const initialLogicState = {
  id: createId(),
  conditions: [
    {
      id: createId(),
      connector: null,
    },
  ],
  actions: [{ objective: "" }],
};

export function ConditionalLogic({
  attributeClasses,
  localSurvey,
  question,
  questionIdx,
  updateQuestion,
}: ConditionalLogicProps) {
  const addLogic = () => {
    updateQuestion(questionIdx, {
      advancedLogic: [...(question?.advancedLogic || []), initialLogicState],
    });
  };

  const handleDeleteLogic = (logicItemIdx: number) => {
    const advancedLogicCopy = structuredClone(question.advancedLogic || []);
    advancedLogicCopy.splice(logicItemIdx, 1);
    updateQuestion(questionIdx, {
      advancedLogic: advancedLogicCopy,
    });
  };

  return (
    <div className="mt-10">
      <Label className="flex gap-2">
        Conditional Logic
        <SplitIcon className="h-4 w-4 rotate-90" />
      </Label>

      {question.advancedLogic && question.advancedLogic?.length > 0 && (
        <div className="logic-scrollbar mt-2 flex w-full flex-col gap-4 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-4">
          {question.advancedLogic.map((logicItem, logicItemIdx) => (
            <div key={logicItem.id} className="flex items-start gap-2">
              <AdvancedLogicEditor
                logicItem={logicItem}
                updateQuestion={updateQuestion}
                question={question}
                questionIdx={questionIdx}
                logicIdx={logicItemIdx}
              />
              <Button
                className="mt-1 p-0"
                onClick={() => {
                  handleDeleteLogic(logicItemIdx);
                }}
                variant="minimal">
                <Trash2Icon className={cn("h-4 w-4 cursor-pointer")} />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center space-x-2 py-1 text-sm">
        <ArrowRightIcon className="h-4 w-4" />
        <p className="text-slate-700">All other answers will continue to the next question</p>
      </div>

      <div className="mt-2 flex items-center space-x-2">
        <Button
          id="logicJumps"
          className="bg-slate-100 hover:bg-slate-50"
          type="button"
          name="logicJumps"
          size="sm"
          variant="secondary"
          StartIcon={SplitIcon}
          startIconClassName="rotate-90"
          onClick={() => addLogic()}>
          Add Logic
        </Button>
      </div>
    </div>
  );
}
