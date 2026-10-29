"use client";

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon, SettingsIcon } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { Checkbox } from "@/modules/ui/components/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { Switch } from "@/modules/ui/components/switch";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import type { TSortOption } from "../lib/types";

export type TTableColumnSetting = {
  id: string;
  label: string;
  visible: boolean;
  /** A column the user cannot hide or move, such as the name or the selection checkbox. */
  locked?: boolean;
};

export type TTableToggleSetting = {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

export type TTableSettingsProps = {
  sort?: {
    options: TSortOption[];
    value: string;
    onChange: (value: string) => void;
  };
  /** Switches such as Show archived or Expand rows. */
  toggles?: TTableToggleSetting[];
  columns?: {
    items: TTableColumnSetting[];
    onVisibilityChange: (columnId: string, visible: boolean) => void;
    onMove: (activeId: string, overId: string) => void;
  };
};

const SortableColumnRow = ({
  column,
  onVisibilityChange,
}: Readonly<{
  column: TTableColumnSetting;
  onVisibilityChange: (columnId: string, visible: boolean) => void;
}>) => {
  const { t } = useTranslation();
  const checkboxId = useId();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
    disabled: column.locked,
  });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        zIndex: isDragging ? 10 : undefined,
      }}
      className="group flex items-center gap-1 rounded-md bg-white px-1 py-1 hover:bg-slate-50">
      {/* The grip leads the row, as drag handles do; a locked column keeps its place with a spacer. */}
      {column.locked ? (
        <span className="size-5 shrink-0" aria-hidden="true" />
      ) : (
        <button
          type="button"
          className="focus-visible:ring-ring flex size-5 shrink-0 cursor-grab items-center justify-center rounded text-slate-300 group-hover:text-slate-500 hover:text-slate-700 focus-visible:text-slate-700 focus-visible:ring-1 focus-visible:outline-hidden active:cursor-grabbing"
          aria-label={t("common.table_toolbar.reorder_column", { column: column.label })}
          {...attributes}
          {...listeners}>
          <GripVerticalIcon className="size-4" />
        </button>
      )}
      <label htmlFor={checkboxId} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
        <Checkbox
          id={checkboxId}
          checked={column.visible}
          disabled={column.locked}
          // A column that always shows reads as fixed: greyed, not merely unclickable.
          className={column.locked ? "border-slate-200 bg-slate-100 disabled:opacity-100" : undefined}
          onCheckedChange={(checked) => onVisibilityChange(column.id, checked === true)}
        />
        <span className="truncate text-sm text-slate-700" title={column.label}>
          {column.label}
        </span>
      </label>
    </li>
  );
};

/** The gear: sort order, view switches and the columns, shown/hidden and dragged into order. */
export const TableSettingsPopover = ({ sort, toggles, columns }: Readonly<TTableSettingsProps>) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const sortId = useId();

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!columns || !over || active.id === over.id) return;
    const overColumn = columns.items.find((column) => column.id === over.id);
    if (overColumn?.locked) return;
    columns.onMove(String(active.id), String(over.id));
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <TooltipRenderer tooltipContent={t("common.table_settings")} triggerClass="flex">
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="size-8 shrink-0 bg-white"
            aria-label={t("common.table_settings")}>
            <SettingsIcon />
          </Button>
        </PopoverTrigger>
      </TooltipRenderer>
      <PopoverContent
        align="start"
        className="w-80 p-2"
        // Opened by mouse, a focus ring on the first control reads as if it were already picked.
        onOpenAutoFocus={(event) => event.preventDefault()}>
        <div className="space-y-1">
          {sort && (
            <div className="flex items-center justify-between gap-2 px-1 py-1">
              <label htmlFor={sortId} className="text-xs font-medium text-slate-500">
                {t("common.sort_by")}
              </label>
              <Select value={sort.value} onValueChange={sort.onChange}>
                <SelectTrigger
                  id={sortId}
                  className="h-7 w-auto min-w-28 border-none px-2 text-xs shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  {sort.options.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-xs">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {toggles?.map((toggle) => (
            <div key={toggle.id} className="flex items-center justify-between gap-2 px-1 py-1">
              <label htmlFor={`table-toggle-${toggle.id}`} className="text-xs font-medium text-slate-500">
                {toggle.label}
              </label>
              <Switch
                id={`table-toggle-${toggle.id}`}
                checked={toggle.checked}
                onCheckedChange={toggle.onCheckedChange}
              />
            </div>
          ))}

          {columns && columns.items.length > 0 && (
            <div className="border-t border-slate-100 pt-2">
              <p className="px-1 pb-1 text-xs font-medium text-slate-500">
                {t("common.table_toolbar.display_columns")}
              </p>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis]}
                onDragEnd={handleDragEnd}>
                <SortableContext
                  items={columns.items.map((c) => c.id)}
                  strategy={verticalListSortingStrategy}>
                  <ul className="max-h-72 [scrollbar-width:thin] overflow-y-auto">
                    {columns.items.map((column) => (
                      <SortableColumnRow
                        key={column.id}
                        column={column}
                        onVisibilityChange={columns.onVisibilityChange}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
