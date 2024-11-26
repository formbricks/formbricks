import { TableSettingsModalItem } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/TableSettingsModalItem";
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
import { SettingsIcon } from "lucide-react";
import { TResponseTableData } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { Modal } from "@formbricks/ui/Modal";

interface TableSettingsModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  survey: TSurvey;
  table: Table<TResponseTableData>;
  columnOrder: string[];
  handleDragEnd: (event: DragEndEvent) => void;
}

export const TableSettingsModal = ({
  open,
  setOpen,
  survey,
  table,
  columnOrder,
  handleDragEnd,
}: TableSettingsModalProps) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

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
                <div className="text-xl font-medium text-slate-700">Table Settings</div>
                <div className="text-sm text-slate-500">Reorder and hide columns</div>
              </div>
            </div>
          </div>
        </div>
        <div className="max-h-[75vh] space-y-2 overflow-auto p-8">
          <DndContext sensors={sensors} onDragEnd={handleDragEnd} collisionDetection={closestCorners}>
            <SortableContext items={columnOrder} strategy={verticalListSortingStrategy}>
              {columnOrder.map((columnId) => {
                if (columnId === "select") return;
                const column = table.getAllColumns().find((column) => column.id === columnId);
                if (!column) return;
                return <TableSettingsModalItem column={column} key={column?.id} survey={survey} />;
              })}
            </SortableContext>
          </DndContext>
        </div>
      </div>
    </Modal>
  );
};
