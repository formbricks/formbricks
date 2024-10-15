"use client";

import { createId } from "@paralleldrive/cuid2";
import * as Collapsible from "@radix-ui/react-collapsible";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@formbricks/lib/cn";
import {
  CXQuestionTypes,
  getQuestionDefaults,
  questionTypes,
  universalQuestionPresets,
} from "@formbricks/lib/utils/questions";
import { TProduct } from "@formbricks/types/product";

interface AddQuestionButtonProps {
  addQuestion: (question: any) => void;
  product: TProduct;
  isCxMode: boolean;
}

export const AddQuestionButton = ({ addQuestion, product, isCxMode }: AddQuestionButtonProps) => {
  const [open, setOpen] = useState(false);
  const [hoveredQuestionId, setHoveredQuestionId] = useState<string | null>(null);

  const availableQuestionTypes = isCxMode ? CXQuestionTypes : questionTypes;

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
            <p className="text-sm font-semibold">Add question</p>
            <p className="mt-1 text-xs text-slate-500">Add a new question to your survey</p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>
      <Collapsible.CollapsibleContent className="justify-left flex flex-col">
        {/* <hr className="py-1 text-slate-600" /> */}
        {availableQuestionTypes.map((questionType) => (
          <button
            type="button"
            key={questionType.id}
            className="group relative mx-2 inline-flex items-center justify-between rounded p-0.5 px-4 py-2 text-sm font-medium text-slate-700 last:mb-2 hover:bg-slate-100 hover:text-slate-800"
            onClick={() => {
              addQuestion({
                ...universalQuestionPresets,
                ...getQuestionDefaults(questionType.id, product),
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
