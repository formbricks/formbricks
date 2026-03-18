"use client";

import {
  type CollisionDetection,
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Table } from "@tanstack/react-table";
import { SettingsIcon } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { TSurvey } from "@formbricks/types/surveys/types";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { DataTableSettingsModalItem } from "./data-table-settings-modal-item";

/**
 * Safari-safe collision detection that validates getBoundingClientRect() properties
 * before using them. Safari can sometimes return DOMRect objects with undefined
 * properties (particularly 'top'), which causes dnd-kit to throw TypeErrors.
 */
const safariSafeClosestCorners: CollisionDetection = (args) => {
  const { droppableContainers } = args;

  // Filter droppable containers to only include those with valid bounding rects
  const validDroppableContainers = droppableContainers.filter((container) => {
    const rect = container.rect.current;
    if (!rect) return false;

    // Check if all required properties exist and are numbers
    return (
      typeof rect.top === "number" &&
      typeof rect.left === "number" &&
      typeof rect.right === "number" &&
      typeof rect.bottom === "number" &&
      typeof rect.width === "number" &&
      typeof rect.height === "number"
    );
  });

  // If all containers were filtered out, return empty array (no collision)
  if (validDroppableContainers.length === 0) {
    return [];
  }

  // Call the original closestCorners with validated containers
  return closestCorners({
    ...args,
    droppableContainers: validDroppableContainers,
  });
};

interface DataTableSettingsModalProps<T> {
  open: boolean;
  setOpen: (open: boolean) => void;
  table: Table<T>;
  columnOrder: string[];
  handleDragEnd: (event: DragEndEvent) => void;
  survey?: TSurvey;
}

export const DataTableSettingsModal = <T,>({
  open,
  setOpen,
  table,
  columnOrder,
  handleDragEnd,
  survey,
}: DataTableSettingsModalProps<T>) => {
  const { t } = useTranslation();
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const tableColumns = useMemo(() => table.getAllColumns(), [table]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <SettingsIcon className="h-6 w-6" />
          <DialogTitle>{t("common.table_settings")}</DialogTitle>
          <DialogDescription>{t("common.reorder_and_hide_columns")}</DialogDescription>
        </DialogHeader>

        <DialogBody className="max-h-[75vh] space-y-2 overflow-auto">
          <DndContext
            id="table-settings"
            sensors={sensors}
            onDragEnd={handleDragEnd}
            collisionDetection={safariSafeClosestCorners}>
            <SortableContext items={columnOrder} strategy={verticalListSortingStrategy}>
              {columnOrder.map((columnId) => {
                if (columnId === "select" || columnId === "createdAt") return;
                const column = tableColumns.find((column) => column.id === columnId);
                if (!column) return null;
                return (
                  <DataTableSettingsModalItem column={column} table={table} key={column.id} survey={survey} />
                );
              })}
            </SortableContext>
          </DndContext>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};
