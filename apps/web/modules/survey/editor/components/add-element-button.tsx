"use client";

import { createId } from "@paralleldrive/cuid2";
import * as Collapsible from "@radix-ui/react-collapsible";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Workspace } from "@formbricks/database/prisma-browser";
import { cn } from "@/lib/cn";
import {
  getCXElementTypes,
  getElementDefaults,
  getElementTypes,
  universalElementPresets,
} from "@/modules/survey/lib/elements";

interface AddElementButtonProps {
  addElement: (element: any) => void;
  workspace: Workspace;
  isCxMode: boolean;
}

export const AddElementButton = ({ addElement, workspace, isCxMode }: AddElementButtonProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
  const availableElementTypes = isCxMode ? getCXElementTypes(t) : getElementTypes(t);

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className={cn(
        open ? "shadow-lg" : "shadow-md",
        "group w-full overflow-hidden rounded-lg border border-slate-300 bg-white duration-200 hover:cursor-pointer hover:bg-slate-50"
      )}>
      <Collapsible.CollapsibleTrigger asChild className="group h-full w-full">
        <div className="inline-flex">
          <div className="flex w-10 items-center justify-center rounded-l-lg bg-brand-dark group-aria-expanded:rounded-br group-aria-expanded:rounded-bl-none">
            <PlusIcon className="size-5 text-white" />
          </div>
          <div className="px-4 py-3">
            <p className="text-sm font-semibold">{t("workspace.surveys.edit.add_block")}</p>
            <p className="mt-1 text-xs text-slate-500">
              {t("workspace.surveys.edit.choose_the_first_question_on_your_block")}
            </p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>
      <Collapsible.CollapsibleContent className="justify-left flex flex-col overflow-hidden pt-2 data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        {availableElementTypes.map((elementType) => (
          <button
            type="button"
            key={elementType.id}
            className="group relative mx-2 inline-flex items-center justify-between rounded-sm p-0.5 px-4 py-2 text-sm font-medium text-slate-700 last:mb-2 hover:bg-slate-100 hover:text-slate-800"
            onClick={() => {
              addElement({
                ...universalElementPresets,
                ...getElementDefaults(elementType.id, workspace, t),
                id: createId(),
                type: elementType.id,
              });
              setOpen(false);
            }}
            onMouseEnter={() => setHoveredElementId(elementType.id)}
            onMouseLeave={() => setHoveredElementId(null)}>
            <div className="flex items-center">
              <elementType.icon className="mr-2 -ml-0.5 size-4 text-brand-dark" aria-hidden="true" />
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
