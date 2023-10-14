"use client";

import { cn } from "@formbricks/lib/cn";
import { TSurveyWithAnalytics } from "@formbricks/types/v1/surveys";
import { TrashIcon } from "@heroicons/react/24/solid";
import * as Collapsible from "@radix-ui/react-collapsible";
import { FC, useState } from "react";
import { Label } from "@formbricks/ui/Label";
import { Input } from "@formbricks/ui/Input";
import { Button } from "@formbricks/ui/Button";

interface HiddenQuestionViewProps {
  localSurvey: TSurveyWithAnalytics;
  setLocalSurvey: (survey: TSurveyWithAnalytics) => void;
  activeQuestionId: string | null;
  setActiveQuestionId: (questionId: string | null) => void;
}

const HiddenQuestionView: FC<HiddenQuestionViewProps> = ({
  activeQuestionId,
  localSurvey,
  setActiveQuestionId,
  setLocalSurvey,
}) => {
  const open = activeQuestionId == "hidden";
  const [hiddenQuestion, setHiddenQuestion] = useState<string>("");

  const setOpen = (e) => {
    if (e) {
      setActiveQuestionId("hidden");
    } else {
      setActiveQuestionId(null);
    }
  };

  const updateSurvey = (data) => {
    setLocalSurvey({
      ...localSurvey,
      hiddenQuestionCard: {
        ...localSurvey.hiddenQuestionCard,
        ...data,
      },
    });
  };

  return (
    <div
      className={cn(
        open ? "scale-100 shadow-lg " : "scale-97 shadow-md",
        "flex flex-row rounded-lg bg-white transition-transform duration-300 ease-in-out"
      )}>
      <div
        className={cn(
          open ? "bg-slate-700" : "bg-slate-400",
          "flex w-10 items-center justify-center rounded-l-lg hover:bg-slate-600 group-aria-expanded:rounded-bl-none"
        )}>
        <p>👁️</p>
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
                <p className="text-sm font-semibold">Hidden Fields Card</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <TrashIcon
                className="h-4 cursor-pointer text-slate-500 hover:text-slate-600"
                onClick={(e) => {
                  e.stopPropagation();
                  updateSurvey({
                    enabled: false,
                  });
                }}
              />
            </div>
          </div>
        </Collapsible.CollapsibleTrigger>
        <Collapsible.CollapsibleContent className="px-4 pb-6">
          <div className="flex gap-2">
            {localSurvey.hiddenQuestionCard?.questions?.map((question, questionIdx) => {
              return (
                <div key={question} className="rounded-full bg-black p-2 text-white">
                  <p>{question}</p>
                </div>
              );
            })}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateSurvey({
                questions: [...(localSurvey.hiddenQuestionCard?.questions || []), hiddenQuestion],
                enabled: true,
              });
            }}>
            <Label htmlFor="headline">Hidden Question</Label>
            <div className="mt-2">
              <Input
                autoFocus
                id="headline"
                name="headline"
                value={hiddenQuestion}
                onChange={(e) => setHiddenQuestion(e.target.value)}
                isInvalid={hiddenQuestion.trim() === ""}
              />
            </div>
            <Button>Add</Button>
          </form>
        </Collapsible.CollapsibleContent>
      </Collapsible.Root>
    </div>
  );
};

export default HiddenQuestionView;
