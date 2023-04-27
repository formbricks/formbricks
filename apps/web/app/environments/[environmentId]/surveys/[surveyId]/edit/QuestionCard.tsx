"use client";

import { getQuestionTypeName } from "@/lib/questions";
import { cn } from "@formbricks/lib/cn";
import type { Question } from "@formbricks/types/questions";
import type { Survey } from "@formbricks/types/surveys";
import { Label, Switch } from "@formbricks/ui";
import {
  ListBulletIcon,
  ChatBubbleBottomCenterTextIcon,
  CursorArrowRippleIcon,
  PresentationChartBarIcon,
  QueueListIcon,
} from "@heroicons/react/24/solid";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useState } from "react";
import { Draggable } from "react-beautiful-dnd";
import MultipleChoiceSingleForm from "./MultipleChoiceSingleForm";
import MultipleChoiceMultiForm from "./MultipleChoiceMultiForm";
import OpenQuestionForm from "./OpenQuestionForm";
import QuestionDropdown from "./QuestionDropdown";
import NPSQuestionForm from "./NPSQuestionForm";
import UpdateQuestionId from "./UpdateQuestionId";
import CTAQuestionForm from "./CTAQuestionForm";

interface QuestionCardProps {
  localSurvey: Survey;
  question: Question;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  deleteQuestion: (questionIdx: number) => void;
  activeQuestionId: string | null;
  setActiveQuestionId: (questionId: string | null) => void;
  lastQuestion: boolean;
}

export default function QuestionCard({
  localSurvey,
  question,
  questionIdx,
  updateQuestion,
  deleteQuestion,
  activeQuestionId,
  setActiveQuestionId,
  lastQuestion,
}: QuestionCardProps) {
  const open = activeQuestionId === question.id;
  const [openAdvanced, setOpenAdvanced] = useState(false);
  return (
    <Draggable draggableId={question.id} index={questionIdx}>
      {(provided) => (
        <div
          className={cn(
            open ? "scale-100 shadow-lg" : "scale-97 shadow-md",
            "flex flex-row rounded-lg bg-white transition-all duration-300 ease-in-out"
          )}
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}>
          <div
            className={cn(
              open ? "bg-slate-700" : "bg-slate-400",
              "top-0 w-10 cursor-move rounded-l-lg p-2 text-center text-sm text-white hover:bg-slate-600"
            )}>
            {questionIdx + 1}
          </div>
          <Collapsible.Root
            open={open}
            onOpenChange={() => {
              if (activeQuestionId !== question.id) {
                // only be able to open other question
                setActiveQuestionId(question.id);
              }
            }}
            className="flex-1 rounded-r-lg border border-slate-200">
            <Collapsible.CollapsibleTrigger
              asChild
              className="flex cursor-pointer justify-between p-4 hover:bg-slate-50">
              <div>
                <div className="inline-flex">
                  <div className="-ml-0.5 mr-2 h-5 w-5 text-slate-400">
                    {question.type === "openText" ? (
                      <ChatBubbleBottomCenterTextIcon />
                    ) : question.type === "multipleChoiceSingle" ? (
                      <QueueListIcon />
                    ) : question.type === "multipleChoiceMulti" ? (
                      <ListBulletIcon />
                    ) : question.type === "nps" ? (
                      <PresentationChartBarIcon />
                    ) : question.type === "cta" ? (
                      <CursorArrowRippleIcon />
                    ) : null}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {question.headline || getQuestionTypeName(question.type)}
                    </p>
                    {!open && question?.required && (
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {question?.required && "Required"}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {open && (
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="required-toggle">Required</Label>
                      <Switch
                        id="required-toggle"
                        checked={question.required}
                        onClick={(e) => {
                          e.stopPropagation();
                          updateQuestion(questionIdx, { required: !question.required });
                        }}
                      />
                    </div>
                  )}
                  <QuestionDropdown deleteQuestion={deleteQuestion} questionIdx={questionIdx} />
                </div>
              </div>
            </Collapsible.CollapsibleTrigger>
            <Collapsible.CollapsibleContent className="px-4 pb-4">
              {question.type === "openText" ? (
                <OpenQuestionForm
                  question={question}
                  questionIdx={questionIdx}
                  updateQuestion={updateQuestion}
                  lastQuestion={lastQuestion}
                />
              ) : question.type === "multipleChoiceSingle" ? (
                <MultipleChoiceSingleForm
                  question={question}
                  questionIdx={questionIdx}
                  updateQuestion={updateQuestion}
                  lastQuestion={lastQuestion}
                />
              ) : question.type === "multipleChoiceMulti" ? (
                <MultipleChoiceMultiForm
                  question={question}
                  questionIdx={questionIdx}
                  updateQuestion={updateQuestion}
                  lastQuestion={lastQuestion}
                />
              ) : question.type === "nps" ? (
                <NPSQuestionForm
                  question={question}
                  questionIdx={questionIdx}
                  updateQuestion={updateQuestion}
                  lastQuestion={lastQuestion}
                />
              ) : question.type === "cta" ? (
                <CTAQuestionForm
                  question={question}
                  questionIdx={questionIdx}
                  updateQuestion={updateQuestion}
                  lastQuestion={lastQuestion}
                />
              ) : null}
              <div className="mt-4 border-t border-slate-200">
                <Collapsible.Root open={openAdvanced} onOpenChange={setOpenAdvanced} className="mt-3">
                  <Collapsible.CollapsibleTrigger className="text-sm text-slate-800">
                    {openAdvanced ? "Hide Advanced Settings" : "Show Advanced Settings"}
                  </Collapsible.CollapsibleTrigger>

                  <Collapsible.CollapsibleContent className="space-y-2">
                    <div className="mt-3">
                      <UpdateQuestionId
                        question={question}
                        questionIdx={questionIdx}
                        localSurvey={localSurvey}
                        updateQuestion={updateQuestion}
                      />
                    </div>
                  </Collapsible.CollapsibleContent>
                </Collapsible.Root>
              </div>
            </Collapsible.CollapsibleContent>
          </Collapsible.Root>
        </div>
      )}
    </Draggable>
  );
}
