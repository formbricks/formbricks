"use client";

import type { TFunction } from "i18next";
import { EyeOffIcon, type LucideIcon, VariableIcon, WebhookIcon } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { WEBHOOK_VARIABLE_MAX_PATHS } from "@formbricks/workflows";
import {
  type TWorkflowVariableGroup,
  type TWorkflowVariableListGroup,
  type TWorkflowVariableOption,
  type TWorkflowVariableTypeHint,
  WORKFLOW_STEP_VARIABLE_PROVIDERS,
  filterWorkflowVariableGroups,
} from "@/modules/ee/workflows/lib/variable-picker";
import { elementIconMapping } from "@/modules/survey/components/element-form-input/components/recall-item-select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { Input } from "@/modules/ui/components/input";

/** Viewport position to open at, e.g. a typed `@` in the JsonEditor. */
export interface TWorkflowVariablePickerAnchor {
  left: number;
  top: number;
  bottom: number;
}

interface WorkflowVariablePickerProps {
  groups: readonly TWorkflowVariableGroup[];
  onSelect: (option: TWorkflowVariableOption) => void;
  /** Closed without a pick: Escape, or a click outside. */
  onClose: () => void;
  /** Where to open; without it the menu opens where it is rendered, as in the kit Editor. */
  anchorRect?: TWorkflowVariablePickerAnchor | null;
  /** Opens the trigger, from the "send a sample payload" hint. */
  onOpenTrigger?: () => void;
  /** Paths already in the text, left out as the survey recall picker does. */
  excludedPaths?: readonly string[];
}

const getTypeHintLabel = (hint: TWorkflowVariableTypeHint, t: TFunction): string => {
  switch (hint) {
    case "text":
      return t("workspace.workflows.variable_type_text");
    case "number":
      return t("workspace.workflows.variable_type_number");
    case "boolean":
      return t("workspace.workflows.variable_type_boolean");
    case "list":
      return t("workspace.workflows.variable_type_list");
    case "object":
      return t("workspace.workflows.variable_type_object");
    case "empty":
      return t("workspace.workflows.variable_type_empty");
  }
};

const getGroupLabel = (group: TWorkflowVariableListGroup, t: TFunction): string => {
  switch (group.kind) {
    case "payload":
      return t("workspace.workflows.variable_group_payload");
    case "response":
      return t("workspace.workflows.variable_group_response");
    case "step": {
      const typeLabel = WORKFLOW_STEP_VARIABLE_PROVIDERS[group.stepType].getTypeLabel(t);
      return group.stepLabel ? `${typeLabel} · ${group.stepLabel}` : typeLabel;
    }
  }
};

const getOptionIcon = (group: TWorkflowVariableListGroup, option: TWorkflowVariableOption): LucideIcon => {
  if (group.kind === "payload") return WebhookIcon;
  if (option.iconKey === "hiddenField") return EyeOffIcon;
  if (option.iconKey && option.iconKey in elementIconMapping) {
    return elementIconMapping[option.iconKey as keyof typeof elementIconMapping];
  }
  return VariableIcon;
};

/**
 * The Variable picker (ENG-7113): the `@` menu of a workflow step field, in the survey recall
 * picker's look and keys — search on top, grouped rows, arrows move, Enter picks, Escape closes.
 * Groups come from `useWorkflowVariableGroups`; the field decides how a picked Variable is written.
 */
export const WorkflowVariablePicker = ({
  groups,
  onSelect,
  onClose,
  anchorRect,
  onOpenTrigger,
  excludedPaths,
}: Readonly<WorkflowVariablePickerProps>) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  // Picking also closes the menu; the close after a pick is not "closed without a pick".
  const hasPickedRef = useRef(false);
  const idPrefix = useId();
  const searchInputId = `${idPrefix}-search`;
  const itemId = (index: number) => `${idPrefix}-item-${index}`;

  const visibleGroups = useMemo(() => {
    if (!excludedPaths?.length) return groups;
    const excluded = new Set(excludedPaths);
    return groups.map((group) => ({
      ...group,
      options: group.options.filter((option) => !excluded.has(option.path)),
    }));
  }, [groups, excludedPaths]);

  const list = useMemo(() => filterWorkflowVariableGroups(visibleGroups, search), [visibleGroups, search]);
  const payloadGroup = groups.find((group) => group.kind === "payload");
  const needsSample = payloadGroup?.kind === "payload" && !payloadGroup.hasSample;
  const isTruncated = payloadGroup?.kind === "payload" && payloadGroup.truncated;

  return (
    <DropdownMenu
      defaultOpen={true}
      modal={true}
      onOpenChange={(open) => {
        if (!open && !hasPickedRef.current) onClose();
      }}>
      <DropdownMenuTrigger className="z-10 cursor-pointer" asChild>
        <div
          className={anchorRect ? "pointer-events-none fixed h-0 w-0" : "flex w-full items-center"}
          style={anchorRect ? { left: anchorRect.left, top: anchorRect.bottom } : undefined}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="flex w-96 flex-col gap-2 bg-slate-50 p-3 text-xs text-slate-700"
        align="start"
        side="bottom"
        aria-label={t("workspace.workflows.variable_picker_label")}
        data-recall-dropdown>
        <Input
          id={searchInputId}
          placeholder={t("workspace.workflows.variable_picker_search")}
          className="w-full bg-white"
          onChange={(event) => setSearch(event.target.value)}
          autoFocus={true}
          value={search}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              document.getElementById(itemId(0))?.focus();
            }
          }}
        />
        <div className="max-h-72 overflow-x-hidden overflow-y-auto">
          {needsSample && (
            <div className="px-2 pt-2 pb-1">
              <p className="text-xs font-medium text-slate-500">
                {t("workspace.workflows.variable_group_payload")}
              </p>
              <p className="pt-1 text-sm text-slate-700">
                {t("workspace.workflows.variable_picker_no_sample")}
                {onOpenTrigger && (
                  <>
                    {" "}
                    <button
                      type="button"
                      className="font-medium text-slate-900 underline underline-offset-2"
                      onClick={onOpenTrigger}>
                      {t("workspace.workflows.variable_picker_open_trigger")}
                    </button>
                  </>
                )}
              </p>
            </div>
          )}
          {list.groups.map((group, groupIndex) => {
            const headingId = `${idPrefix}-group-${groupIndex}`;
            return (
              <div key={headingId} role="group" aria-labelledby={headingId}>
                <p id={headingId} className="px-2 pt-2 pb-1 text-xs font-medium text-slate-500">
                  {getGroupLabel(group, t)}
                </p>
                {group.options.map((option) => {
                  const Icon = getOptionIcon(group, option);
                  const { index } = option;
                  return (
                    <DropdownMenuItem
                      id={index === null ? undefined : itemId(index)}
                      key={option.path}
                      disabled={!option.isPickable}
                      title={
                        option.isPickable
                          ? undefined
                          : t("workspace.workflows.variable_picker_list_not_supported")
                      }
                      onSelect={() => {
                        hasPickedRef.current = true;
                        onSelect(option);
                      }}
                      className="flex w-full cursor-pointer items-center rounded-md p-2 focus:bg-slate-200 focus:outline-hidden"
                      onKeyDown={(event) => {
                        if (
                          (event.key === "ArrowUp" && index === 0) ||
                          (event.key === "ArrowDown" && index === list.pickableCount - 1)
                        ) {
                          event.preventDefault();
                          document.getElementById(searchInputId)?.focus();
                        }
                      }}>
                      <div className="mr-2 size-4 shrink-0 text-slate-500">
                        <Icon className="size-4" />
                      </div>
                      <p className="max-w-full overflow-hidden text-sm font-normal text-ellipsis whitespace-nowrap">
                        {option.label || t("common.no_text_found")}
                      </p>
                      <span className="ml-auto shrink-0 pl-2 font-mono text-xs text-slate-500">
                        {getTypeHintLabel(option.typeHint, t)}
                      </span>
                    </DropdownMenuItem>
                  );
                })}
              </div>
            );
          })}
          {list.groups.length === 0 && !needsSample && (
            <p className="p-2 text-sm font-medium text-slate-700">
              {t("workspace.workflows.variable_picker_no_results")}
            </p>
          )}
          {isTruncated && (
            <p className="px-2 pt-2 text-xs text-slate-500">
              {t("workspace.workflows.variable_picker_truncated", { count: WEBHOOK_VARIABLE_MAX_PATHS })}
            </p>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
