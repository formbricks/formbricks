import { Logic, Question } from "@formbricks/types/questions";
import { Survey } from "@formbricks/types/surveys";
import Button from "@formbricks/ui/Button";
import { Label } from "@formbricks/ui/Label";
import { ForwardIcon } from "@heroicons/react/24/outline";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@formbricks/ui/Select";
import { ArrowDownIcon, TrashIcon } from "@heroicons/react/24/solid";
import { BsArrowReturnRight, BsArrowDown } from "react-icons/bs";

interface LogicEditorProps {
  localSurvey: Survey;
  questionIdx: number;
  question: Question;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
}

export default function LogicEditor({
  localSurvey,
  question,
  questionIdx,
  updateQuestion,
}: LogicEditorProps) {
  const addLogic = () => {
    const newLogic: Logic[] = !question.logic ? [] : question.logic;
    newLogic.push({ condition: "submitted", value: undefined, destination: "" });
    updateQuestion(questionIdx, { logic: newLogic });
  };
  const updateLogic = (logicIdx: number, updatedAttributes: any) => {
    const newLogic = !question.logic
      ? []
      : question.logic.map((logic, idx) => {
          if (idx === logicIdx) {
            return { ...logic, ...updatedAttributes };
          }
          return logic;
        });
    updateQuestion(questionIdx, { logic: newLogic });
  };

  const deleteLogic = (logicIdx: number) => {
    const newLogic = !question.logic ? [] : question.logic.filter((_, idx) => idx !== logicIdx);
    updateQuestion(questionIdx, { logic: newLogic });
  };
  //   console.log(question?.logic?.[0]?.destination);

  return (
    <div className="mt-3">
      <Label>Logic Jumps</Label>

      {question?.logic?.length !== 0 && (
        <div className="mt-2">
          <div className="flex flex-col space-y-2">
            {question?.logic?.map((logic, idx) => (
              <div key={idx} className="flex flex-wrap items-center space-x-2 text-sm">
                <BsArrowReturnRight className="h-4 w-4" />
                <p>If this answer is</p>

                <Select
                  defaultValue={logic.condition}
                  onValueChange={(e) => updateLogic(questionIdx, { condition: e })}>
                  <SelectTrigger className="w-fit dark:text-slate-200">
                    <SelectValue placeholder="Select condition" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="skipped">Skipped</SelectItem>
                    <SelectItem value="answered">Answered</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  defaultValue={logic.value}
                  onValueChange={(e) => updateLogic(questionIdx, { value: e })}>
                  <SelectTrigger className="w-fit dark:text-slate-200">
                    <SelectValue placeholder="Select match type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">True</SelectItem>
                    <SelectItem value="false">False</SelectItem>
                  </SelectContent>
                </Select>
                <p>skip to</p>

                <Select
                  defaultValue={logic.destination}
                  onValueChange={(e) => updateLogic(questionIdx, { destination: e })}>
                  <SelectTrigger className="w-[180px] overflow-hidden dark:text-slate-200">
                    <SelectValue className="overflow-hidden" placeholder="Select destination question" />
                  </SelectTrigger>
                  <SelectContent>
                    {localSurvey.questions.map((question) => (
                      <SelectItem key={question.id} value={question.id}>
                        {question.headline}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <TrashIcon
                  className="ml-2 h-4 w-4 cursor-pointer text-slate-400"
                  onClick={() => deleteLogic(idx)}
                />
              </div>
            ))}
            <div className="flex flex-wrap items-center space-x-2 text-sm">
              <BsArrowDown className="h-4 w-4" />
              <p>All other answers will continue to the next question</p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-2">
        <Button
          id="logicJumps"
          type="button"
          name="logicJumps"
          variant="secondary"
          EndIcon={ForwardIcon}
          onClick={() => addLogic()}>
          Add Logic
        </Button>
      </div>
    </div>
  );
}
