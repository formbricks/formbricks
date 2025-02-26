"use client";

import {
  getCXQuestionTypes,
  getQuestionDefaults,
  getQuestionTypes,
  universalQuestionPresets,
} from "@/modules/survey/editor/lib/questions";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { createId } from "@paralleldrive/cuid2";
import { Project } from "@prisma/client";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useTranslate } from "@tolgee/react";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@formbricks/lib/cn";

interface AddQuestionButtonProps {
  addQuestion: (question: any) => void;
  project: Project;
  isCxMode: boolean;
}

export const AddQuestionButton = ({ addQuestion, project, isCxMode }: AddQuestionButtonProps) => {
  const { t } = useTranslate();
  const [open, setOpen] = useState(false);
  const [hoveredQuestionId, setHoveredQuestionId] = useState<string | null>(null);
  const availableQuestionTypes = isCxMode ? getCXQuestionTypes(t) : getQuestionTypes(t);
  const [parent] = useAutoAnimate();

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className={cn(
        open ? "shadow-lg" : "shadow-md",
        "group w-full space-y-2 rounded-lg border border-slate-300 bg-white duration-200 hover:cursor-pointer hover:bg-slate-50"
      )}>
      <Collapsible.CollapsibleTrigger asChild className="group h-full w-full">
        <div className="inline-flex">
          <div className="bg-brand-dark flex w-10 items-center justify-center rounded-l-lg group-aria-expanded:rounded-bl-none group-aria-expanded:rounded-br">
            <PlusIcon className="h-5 w-5 text-white" />
          </div>
          <div className="px-4 py-3">
            <p className="text-sm font-semibold">{t("environments.surveys.edit.add_question")}</p>
            <p className="mt-1 text-xs text-slate-500">
              {t("environments.surveys.edit.add_a_new_question_to_your_survey")}
            </p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>
      <Collapsible.CollapsibleContent className="justify-left flex flex-col" ref={parent}>
        {/* <hr className="py-1 text-slate-600" /> */}
        {availableQuestionTypes.map((questionType) => (
          <button
            type="button"
            key={questionType.id}
            className="group relative mx-2 inline-flex items-center justify-between rounded p-0.5 px-4 py-2 text-sm font-medium text-slate-700 last:mb-2 hover:bg-slate-100 hover:text-slate-800"
            onClick={() => {
              addQuestion({
                ...universalQuestionPresets,
                ...getQuestionDefaults(questionType.id, project, t),
                id: createId(),
                type: questionType.id,
              });
              setOpen(false);
            }}
            onMouseEnter={() => setHoveredQuestionId(questionType.id)}
            onMouseLeave={() => setHoveredQuestionId(null)}>
            <div className="flex items-center">
              <questionType.icon className="text-brand-dark -ml-0.5 mr-2 h-4 w-4" aria-hidden="true" />
              {questionType.label}
            </div>
            <div
              className={`absolute right-4 text-xs font-light text-slate-500 transition-opacity duration-200 ${
                hoveredQuestionId === questionType.id ? "opacity-100" : "opacity-0"
              }`}>
              {questionType.description}
            </div>
          </button>
        ))}
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
};
