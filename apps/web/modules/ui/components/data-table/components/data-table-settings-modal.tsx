"use client";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Table } from "@tanstack/react-table";
import { useTranslate } from "@tolgee/react";
import { SettingsIcon } from "lucide-react";
import { useMemo } from "react";
import { TSurvey } from "@formbricks/types/surveys/types";
import { DataTableSettingsModalItem } from "./data-table-settings-modal-item";

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
  const { t } = useTranslate();
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
            collisionDetection={closestCorners}>
            <SortableContext items={columnOrder} strategy={verticalListSortingStrategy}>
              {columnOrder.map((columnId) => {
                if (columnId === "select" || columnId === "createdAt") return;
                const column = tableColumns.find((column) => column.id === columnId);
                if (!column) return null;
                return <DataTableSettingsModalItem column={column} key={column.id} survey={survey} />;
              })}
            </SortableContext>
          </DndContext>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};
