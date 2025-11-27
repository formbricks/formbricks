"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import { createId } from "@paralleldrive/cuid2";
import { Project } from "@prisma/client";
import * as Collapsible from "@radix-ui/react-collapsible";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import {
  getCXElementTypes,
  getElementDefaults,
  getElementTypes,
  universalElementPresets,
} from "@/modules/survey/lib/elements";

interface AddElementButtonProps {
  addElement: (element: any) => void;
  project: Project;
  isCxMode: boolean;
}

export const AddElementButton = ({ addElement, project, isCxMode }: AddElementButtonProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
  const availableElementTypes = isCxMode ? getCXElementTypes(t) : getElementTypes(t);
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
            <p className="text-sm font-semibold">{t("environments.surveys.edit.add_block")}</p>
            <p className="mt-1 text-xs text-slate-500">
              {t("environments.surveys.edit.choose_the_first_question_on_your_block")}
            </p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>
      <Collapsible.CollapsibleContent className="justify-left flex flex-col" ref={parent}>
        {availableElementTypes.map((elementType) => (
          <button
            type="button"
            key={elementType.id}
            className="group relative mx-2 inline-flex items-center justify-between rounded p-0.5 px-4 py-2 text-sm font-medium text-slate-700 last:mb-2 hover:bg-slate-100 hover:text-slate-800"
            onClick={() => {
              addElement({
                ...universalElementPresets,
                ...getElementDefaults(elementType.id, project, t),
                id: createId(),
                type: elementType.id,
              });
              setOpen(false);
            }}
            onMouseEnter={() => setHoveredElementId(elementType.id)}
            onMouseLeave={() => setHoveredElementId(null)}>
            <div className="flex items-center">
              <elementType.icon className="text-brand-dark -ml-0.5 mr-2 h-4 w-4" aria-hidden="true" />
              {elementType.label}
            </div>
            <div
              className={`absolute right-4 text-xs font-light text-slate-500 transition-opacity duration-200 ${
                hoveredElementId === elementType.id ? "opacity-100" : "opacity-0"
              }`}>
              {elementType.description}
            </div>
          </button>
        ))}
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
};
