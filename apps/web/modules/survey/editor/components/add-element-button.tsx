"use client";

import { createId } from "@paralleldrive/cuid2";
import * as Collapsible from "@radix-ui/react-collapsible";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Workspace } from "@formbricks/database/prisma-browser";
import { cn } from "@/lib/cn";
import {
  type TElement,
  type TElementCategoryMeta,
  getCXElementTypes,
  getElementCategories,
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
  const availableElementTypes = isCxMode ? getCXElementTypes(t) : getElementTypes(t);
  const categories = getElementCategories(t);

  const handleAddElement = (elementType: TElement) => {
    addElement({
      ...universalElementPresets,
      ...getElementDefaults(elementType.id, workspace, t),
      id: createId(),
      type: elementType.id,
    });
    setOpen(false);
  };

  // Group the available element types by category while keeping their defined order.
  const elementsByCategory = new Map<string, TElement[]>();
  for (const elementType of availableElementTypes) {
    const group = elementsByCategory.get(elementType.category) ?? [];
    group.push(elementType);
    elementsByCategory.set(elementType.category, group);
  }

  // Only render categories that actually contain elements (CX mode uses a subset).
  const visibleCategories = categories.filter(
    (category) => (elementsByCategory.get(category.id)?.length ?? 0) > 0
  );

  const renderCategory = (category: TElementCategoryMeta) => {
    const elements = elementsByCategory.get(category.id) ?? [];
    return (
      <div key={category.id} className="mb-1">
        <p
          className={cn(
            "px-2 pt-3 pb-1 text-xs font-semibold tracking-wide uppercase",
            category.labelClassName
          )}>
          {category.label}
        </p>
        {elements.map((elementType) => (
          <button
            type="button"
            key={elementType.id}
            title={elementType.description}
            className="group flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900"
            onClick={() => handleAddElement(elementType)}>
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-md",
                category.iconClassName
              )}>
              <elementType.icon className="size-4" aria-hidden="true" />
            </span>
            <span>{elementType.label}</span>
          </button>
        ))}
      </div>
    );
  };

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
          <div className="flex w-10 items-center justify-center rounded-l-[7px] bg-brand-dark group-aria-expanded:rounded-br group-aria-expanded:rounded-bl-none">
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
      <Collapsible.CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <div className="grid grid-cols-1 gap-x-6 px-3 pb-3 sm:grid-cols-2">
          <div>{visibleCategories.filter((category) => category.column === 1).map(renderCategory)}</div>
          <div>{visibleCategories.filter((category) => category.column === 2).map(renderCategory)}</div>
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
};
