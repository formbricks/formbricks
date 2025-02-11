"use client";

import { Modal } from "@/modules/ui/components/modal";
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
    <Modal open={open} setOpen={setOpen} noPadding closeOnOutsideClick={true}>
      <div className="flex h-full flex-col rounded-lg">
        <div className="rounded-t-lg bg-slate-100">
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center space-x-2">
              <div className="mr-1.5 flex h-10 w-10 items-center justify-center text-slate-500">
                <SettingsIcon className="h-6 w-6" />
              </div>
              <div>
                <div className="text-xl font-medium text-slate-700">{t("common.table_settings")}</div>
                <div className="text-sm text-slate-500">{t("common.reorder_and_hide_columns")}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="max-h-[75vh] space-y-2 overflow-auto p-8">
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
        </div>
      </div>
    </Modal>
  );
};
