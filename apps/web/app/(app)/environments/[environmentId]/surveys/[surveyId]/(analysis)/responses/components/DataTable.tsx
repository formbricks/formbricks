import {
  TTableData,
  generateColumns,
} from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/Columns";
import { DataTableToolbar } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/DataTableToolbar";
import { DraggableTableHeader } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/DraggableTableHeader";
import { SelectedResponseSettings } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/SelectedResponseSettings";
import { TableSettingsModal } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/TableSettingsModal";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import { SortableContext, arrayMove, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { VisibilityState, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Maximize2Icon } from "lucide-react";
import React, { useEffect, useState } from "react";
import { cn } from "@formbricks/lib/cn";
import { TEnvironment } from "@formbricks/types/environment";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { TUser } from "@formbricks/types/user";
import { Button } from "@formbricks/ui/Button";
import { Modal } from "@formbricks/ui/Modal";
import { SingleResponseCard } from "@formbricks/ui/SingleResponseCard";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@formbricks/ui/Table";

interface DataTableProps {
  data: TTableData[];
  survey: TSurvey;
  responses: TResponse[];
  environment: TEnvironment;
  user?: TUser;
  environmentTags: TTag[];
  isViewer: boolean;
  fetchNextPage: () => void;
  hasMore: boolean;
  deleteResponses: (responseIds: string[]) => void;
  updateResponse: (responseId: string, updatedResponse: TResponse) => void;
}

export const DataTable = ({
  data,
  survey,
  responses,
  user,
  environment,
  environmentTags,
  isViewer,
  fetchNextPage,
  hasMore,
  deleteResponses,
  updateResponse,
}: DataTableProps) => {
  // State for table controls
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [isTableSettingsModalOpen, setIsTableSettingsModalOpen] = useState(false);
  const [selectedResponseCard, setSelectedResponseCard] = useState<TResponse | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);

  // Generate columns
  const columns = generateColumns(survey, isExpanded, isViewer);

  // Initialize DnD sensors
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  );

  // React Table instance
  const table = useReactTable({
    data,
    columns,
    getRowId: (originalRow) => originalRow.responseId,
    getCoreRowModel: getCoreRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onColumnOrderChange: setColumnOrder,
    columnResizeMode: "onChange",
    columnResizeDirection: "ltr",
    manualPagination: true,
    defaultColumn: { size: 300 },
    state: { columnOrder, columnVisibility, rowSelection },
  });

  useEffect(() => {
    // Set initial column order
    const setInitialColumnOrder = () => {
      table.setColumnOrder(table.getAllLeafColumns().map((d) => d.id));
    };
    setInitialColumnOrder();
  }, [table]);

  // Handle column drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setColumnOrder((prevOrder) => {
        const oldIndex = prevOrder.indexOf(active.id as string);
        const newIndex = prevOrder.indexOf(over.id as string);
        return arrayMove(prevOrder, oldIndex, newIndex);
      });
    }
  };

  return (
    <div>
      <DndContext
        collisionDetection={closestCenter}
        modifiers={[restrictToHorizontalAxis]}
        onDragEnd={handleDragEnd}
        sensors={sensors}>
        <div className="my-2 flex w-full items-center justify-between">
          {table.getFilteredSelectedRowModel().rows.length > 0 ? (
            <SelectedResponseSettings table={table} deleteResponses={deleteResponses} />
          ) : (
            <div></div>
          )}
          <DataTableToolbar
            setIsExpanded={setIsExpanded}
            setIsTableSettingsModalOpen={setIsTableSettingsModalOpen}
            isExpanded={isExpanded}
          />
        </div>

        <div className="rounded-md border">
          <Table style={{ width: table.getCenterTotalSize(), tableLayout: "fixed" }}>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
                    {headerGroup.headers.map((header) => (
                      <DraggableTableHeader
                        key={header.id}
                        header={header}
                        setIsTableSettingsModalOpen={setIsTableSettingsModalOpen}
                      />
                    ))}
                  </SortableContext>
                </tr>
              ))}
            </TableHeader>

            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={cn(row.getIsSelected() ? "bg-slate-200" : "", "group hover:bg-slate-200")}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className="border border-slate-300"
                        style={{ width: `${cell.column.getSize()}px` }}>
                        <div className="flex w-full items-center">
                          <div
                            className={cn(
                              "flex flex-1 items-center truncate",
                              isExpanded ? "h-full" : "h-10"
                            )}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </div>

                          {cell.column.id === "createdAt" && (
                            <Button
                              variant="minimal"
                              className="hidden h-full flex-shrink-0 items-center group-hover:flex"
                              onClick={() => {
                                const response = responses.find((response) => response.id === row.id);
                                if (response) {
                                  setSelectedResponseCard(response);
                                }
                              }}>
                              <Maximize2Icon className="ml-4 h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {hasMore && data.length > 0 && (
          <div className="mt-4 flex justify-center">
            <Button onClick={fetchNextPage} className="bg-blue-500 text-white">
              Load More
            </Button>
          </div>
        )}

        <TableSettingsModal
          open={isTableSettingsModalOpen}
          setOpen={setIsTableSettingsModalOpen}
          survey={survey}
          table={table}
          columnOrder={columnOrder}
          handleDragEnd={handleDragEnd}
        />

        {selectedResponseCard && (
          <Modal
            open={!!selectedResponseCard}
            setOpen={(isOpen) => !isOpen && setSelectedResponseCard(null)}
            closeOnOutsideClick={true}
            className="max-h-[80vh] overflow-auto"
            size="xl">
            <SingleResponseCard
              survey={survey}
              response={selectedResponseCard}
              user={user}
              pageType="response"
              environment={environment}
              environmentTags={environmentTags}
              isViewer={isViewer}
              updateResponse={updateResponse}
              deleteResponses={deleteResponses}
              setSelectedResponseCard={setSelectedResponseCard}
            />
          </Modal>
        )}
      </DndContext>
    </div>
  );
};
