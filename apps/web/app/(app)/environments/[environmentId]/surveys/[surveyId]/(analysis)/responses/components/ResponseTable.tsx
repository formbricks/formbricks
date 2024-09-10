import { ResponseCardModal } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponseCardModal";
import { ResponseTableCell } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponseTableCell";
import { generateColumns } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponseTableColumns";
import { ResponseTableHeader } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponseTableHeader";
import { ResponseTableToolbar } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponseTableToolbar";
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
import { VisibilityState, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { TEnvironment } from "@formbricks/types/environment";
import { TResponse, TResponseTableData } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { TUser } from "@formbricks/types/user";
import { Button } from "@formbricks/ui/Button";
import { Skeleton } from "@formbricks/ui/Skeleton";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@formbricks/ui/Table";

interface ResponseTableProps {
  data: TResponseTableData[];
  survey: TSurvey;
  responses: TResponse[] | null;
  environment: TEnvironment;
  user?: TUser;
  environmentTags: TTag[];
  isViewer: boolean;
  fetchNextPage: () => void;
  hasMore: boolean;
  deleteResponses: (responseIds: string[]) => void;
  updateResponse: (responseId: string, updatedResponse: TResponse) => void;
  isFetchingFirstPage: boolean;
}

export const ResponseTable = ({
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
  isFetchingFirstPage,
}: ResponseTableProps) => {
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [isTableSettingsModalOpen, setIsTableSettingsModalOpen] = useState(false);
  const [selectedResponse, setSelectedResponse] = useState<TResponse | null>(null);
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

  // Memoize table data and columns
  const tableData: TResponseTableData[] = useMemo(
    () => (isFetchingFirstPage ? Array(10).fill({}) : data),
    [data]
  );
  const tableColumns = useMemo(
    () =>
      isFetchingFirstPage
        ? columns.map((column) => ({
            ...column,
            cell: () => (
              <Skeleton className="w-full">
                <div className="h-6"></div>
              </Skeleton>
            ),
          }))
        : columns,
    [columns, data]
  );

  // React Table instance
  const table = useReactTable({
    data: tableData,
    columns: tableColumns,
    getRowId: (originalRow) => originalRow.responseId,
    getCoreRowModel: getCoreRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onColumnOrderChange: setColumnOrder,
    columnResizeMode: "onChange",
    columnResizeDirection: "ltr",
    manualPagination: true,
    defaultColumn: { size: 300 },
    state: {
      columnOrder,
      columnVisibility,
      rowSelection,
      columnPinning: {
        left: ["select", "createdAt"],
      },
    },
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
        <ResponseTableToolbar
          setIsExpanded={setIsExpanded}
          setIsTableSettingsModalOpen={setIsTableSettingsModalOpen}
          isExpanded={isExpanded}
          table={table}
          deleteResponses={deleteResponses}
        />
        <div>
          <Table style={{ width: table.getCenterTotalSize(), tableLayout: "fixed" }}>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
                    {headerGroup.headers.map((header) => (
                      <ResponseTableHeader
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
              {table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={"group cursor-pointer"}>
                  {row.getVisibleCells().map((cell) => (
                    <ResponseTableCell
                      key={cell.id}
                      cell={cell}
                      row={row}
                      isExpanded={isExpanded}
                      setSelectedResponseCard={setSelectedResponse}
                      responses={responses}
                    />
                  ))}
                </TableRow>
              ))}
              {table.getRowModel().rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {data && hasMore && data.length > 0 && (
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

        {responses && (
          <ResponseCardModal
            survey={survey}
            responses={responses}
            user={user}
            environment={environment}
            environmentTags={environmentTags}
            isViewer={isViewer}
            updateResponse={updateResponse}
            deleteResponses={deleteResponses}
            setSelectedResponse={setSelectedResponse}
            selectedResponse={selectedResponse}
            open={selectedResponse !== null}
            setOpen={(open) => {
              if (!open) {
                setSelectedResponse(null);
              }
            }}
          />
        )}
      </DndContext>
    </div>
  );
};
