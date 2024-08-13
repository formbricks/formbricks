"use client";

import { createId } from "@paralleldrive/cuid2";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { cn } from "@formbricks/lib/cn";
import { TSurvey, TSurveyVariable } from "@formbricks/types/surveys/types";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@formbricks/ui/Select";

interface SurveyVariablesCardProps {
  localSurvey: TSurvey;
  setLocalSurvey: (survey: TSurvey) => void;
  activeQuestionId: string | null;
  setActiveQuestionId: (questionId: string | null) => void;
}

export const SurveyVariablesCard = ({
  activeQuestionId,
  localSurvey,
  setActiveQuestionId,
  setLocalSurvey,
}: SurveyVariablesCardProps) => {
  const open = activeQuestionId == "hidden";
  const [variableName, setVariableName] = useState("");
  const [variableType, setVariableType] = useState<TSurveyVariable["type"]>("number");
  const [variableValue, setVariableValue] = useState<string | number>(variableType === "number" ? 0 : "");

  const setOpen = (open: boolean) => {
    if (open) {
      setActiveQuestionId("hidden");
    } else {
      setActiveQuestionId(null);
    }
  };

  const updateSurvey = (data: TSurveyVariable) => {
    console.log({ data });
    setLocalSurvey({
      ...localSurvey,
      variables: [...localSurvey.variables, data],
    });
  };

  console.log("localSurvey.variables", localSurvey.variables);

  return (
    <div className={cn(open ? "shadow-lg" : "shadow-md", "group z-10 flex flex-row rounded-lg bg-white")}>
      <div
        className={cn(
          open ? "bg-slate-50" : "bg-white group-hover:bg-slate-50",
          "flex w-10 items-center justify-center rounded-l-lg border-b border-l border-t group-aria-expanded:rounded-bl-none"
        )}>
        <p>🪣</p>
      </div>
      <Collapsible.Root
        open={open}
        onOpenChange={setOpen}
        className="flex-1 rounded-r-lg border border-slate-200 transition-all duration-300 ease-in-out">
        <Collapsible.CollapsibleTrigger
          asChild
          className="flex cursor-pointer justify-between p-4 hover:bg-slate-50">
          <div>
            <div className="inline-flex">
              <div>
                <p className="text-sm font-semibold">Variables</p>
              </div>
            </div>
          </div>
        </Collapsible.CollapsibleTrigger>
        <Collapsible.CollapsibleContent className="px-4 pb-6">
          <div className="flex gap-2">
            {localSurvey.variables.length > 0 ? (
              // localSurvey.variables.map((variable) => {
              //   return (
              //     <Tag
              //       key={variable.name}
              //       onDelete={() => {
              //         updateSurvey({
              //           enabled: true,
              //           variables: localSurvey.variables.filter((v) => v.name !== variable.name),
              //         });
              //       }}
              //       tagId={variable.name}
              //       tagName={variable.name}
              //     />
              //   );
              // })

              <p>{JSON.stringify(localSurvey.variables)}</p>
            ) : (
              <p className="mt-2 text-sm italic text-slate-500">No variables yet. Add the first one below.</p>
            )}
          </div>
          <form
            className="mt-5"
            onSubmit={(e) => {
              e.preventDefault();
              // const existingQuestionIds = localSurvey.questions.map((question) => question.id);
              // const existingEndingCardIds = localSurvey.endings.map((ending) => ending.id);
              // const existingHiddenFieldIds = localSurvey.hiddenFields.fieldIds ?? [];
              // const validateIdError = validateId(
              //   "Hidden field",
              //   hiddenField,
              //   existingQuestionIds,
              //   existingEndingCardIds,
              //   existingHiddenFieldIds
              // );

              // if (validateIdError) {
              //   toast.error(validateIdError);
              //   return;
              // }

              if (variableType === "number") {
                updateSurvey({
                  id: createId(),
                  name: variableName,
                  value: Number(variableValue),
                  type: variableType,
                });
              } else {
                updateSurvey({
                  id: createId(),
                  name: variableName,
                  value: String(variableValue),
                  type: variableType,
                });
              }

              toast.success("Variable added successfully");
              setVariableName("");
              setVariableValue("");
            }}>
            <Label htmlFor="headline">Variable</Label>
            <div className="mt-2 flex items-center justify-center gap-2">
              <Input
                autoFocus
                id="variableName"
                name="variableName"
                value={variableName}
                onChange={(e) => setVariableName(e.target.value.trim())}
                placeholder="Field name e.g, score, price"
              />

              <Select
                value={variableType}
                onValueChange={(value: "number" | "text") => {
                  setVariableType(value);
                }}>
                <SelectTrigger className="min-w-fit flex-1">
                  <SelectValue placeholder="Select type" className="text-sm" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={"number"}>Number</SelectItem>
                  <SelectItem value={"text"}>Text</SelectItem>
                </SelectContent>
              </Select>

              <p className="text-slate-600">=</p>

              <Input
                autoFocus
                id="variableValue"
                name="variableValue"
                value={variableValue}
                onChange={(e) => setVariableValue(e.target.value.trim())}
                placeholder="Initial value"
                type={variableType === "number" ? "number" : "text"}
              />
              <Button variant="secondary" type="submit" size="sm" className="whitespace-nowrap">
                Add variable
              </Button>
            </div>
          </form>
        </Collapsible.CollapsibleContent>
      </Collapsible.Root>
    </div>
  );
};
