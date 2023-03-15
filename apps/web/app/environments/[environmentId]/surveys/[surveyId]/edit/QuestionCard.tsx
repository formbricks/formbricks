"use client";

import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Switch } from "@/components/ui/Switch";
import { cn } from "@/lib/utils";
import { Bars4Icon } from "@heroicons/react/20/solid";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useState } from "react";
import QuestionDropdown from "./QuestionDropdown";
import { Draggable } from "react-beautiful-dnd";
import type { Question } from "@/types/questions";

interface QuestionCardProps {
  question: Question;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  deleteQuestion: (questionIdx: number) => void;
}

export default function QuestionCard({
  question,
  questionIdx,
  updateQuestion,
  deleteQuestion,
}: QuestionCardProps) {
  const [open, setOpen] = useState(true);
  return (
    <Draggable draggableId={question.id} index={questionIdx}>
      {(provided) => (
        <div
          className="flex flex-row rounded-lg bg-white shadow-lg"
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}>
          <div
            className={cn(
              open ? "bg-slate-600" : "bg-slate-500",
              "top-0 w-10 cursor-pointer rounded-l-lg p-2 text-center text-sm text-white hover:bg-slate-700"
            )}>
            {questionIdx + 1}
          </div>
          <Collapsible.Root
            open={open}
            onOpenChange={setOpen}
            className="flex-1 rounded-r-lg border border-gray-200">
            <Collapsible.CollapsibleTrigger asChild className="flex cursor-pointer justify-between p-4">
              <div>
                <div className="inline-flex">
                  <Bars4Icon className="-ml-0.5 mr-2 h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-sm font-semibold">{question.headline}</p>
                    {!open && question?.required && (
                      <p className="mt-1 truncate text-xs text-gray-500">
                        {question?.required && "Required"}
                      </p>
                    )}
                  </div>
                </div>
                {open && (
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="airplane-mode">Required</Label>
                    <Switch
                      id="airplane-mode"
                      checked={question.required}
                      onClick={(e) => {
                        e.stopPropagation();
                        updateQuestion(questionIdx, { required: !question.required });
                      }}
                    />
                    <QuestionDropdown deleteQuestion={deleteQuestion} questionIdx={questionIdx} />
                  </div>
                )}
              </div>
            </Collapsible.CollapsibleTrigger>
            <Collapsible.CollapsibleContent className="px-4 pb-4">
              <form>
                <div className="mt-3">
                  <Label htmlFor="headline">Headline</Label>
                  <div className="mt-2">
                    <Input
                      id="headline"
                      name="headline"
                      value={question.headline}
                      onChange={(e) => updateQuestion(questionIdx, { headline: e.target.value })}
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <Label htmlFor="subheader">Subheader</Label>
                  <div className="mt-2">
                    <Input
                      id="subheader"
                      name="subheader"
                      value={question.subheader}
                      onChange={(e) => updateQuestion(questionIdx, { subheader: e.target.value })}
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <Label htmlFor="placeholder">Placeholder</Label>
                  <div className="mt-2">
                    <Input
                      id="placeholder"
                      name="placeholder"
                      value={question.placeholder}
                      onChange={(e) => updateQuestion(questionIdx, { placeholder: e.target.value })}
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <Label htmlFor="buttonLabel">Button Label</Label>
                  <div className="mt-2">
                    <Input
                      id="buttonLabel"
                      name="buttonLabel"
                      value={question.buttonLabel}
                      onChange={(e) => updateQuestion(questionIdx, { buttonLabel: e.target.value })}
                    />
                  </div>
                </div>
              </form>
            </Collapsible.CollapsibleContent>
          </Collapsible.Root>
        </div>
      )}
    </Draggable>
  );
}
