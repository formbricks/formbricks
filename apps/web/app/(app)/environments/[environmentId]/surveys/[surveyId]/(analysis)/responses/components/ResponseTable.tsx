"use client";

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
import { useAutoAnimate } from "@formkit/auto-animate/react";
import * as Sentry from "@sentry/nextjs";
import { VisibilityState, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useTranslate } from "@tolgee/react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { TEnvironment } from "@formbricks/types/environment";
import { TSurveyQuota } from "@formbricks/types/quota";
import { TResponseTableData, TResponseWithQuotas } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { TUser, TUserLocale } from "@formbricks/types/user";
import { ResponseCardModal } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponseCardModal";
import { ResponseTableCell } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponseTableCell";
import { generateResponseTableColumns } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponseTableColumns";
import { getResponsesDownloadUrlAction } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/actions";
import { downloadResponsesFile } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/utils";
import { deleteResponseAction } from "@/modules/analysis/components/SingleResponseCard/actions";
import { Button } from "@/modules/ui/components/button";
import {
  DataTableHeader,
  DataTableSettingsModal,
  DataTableToolbar,
} from "@/modules/ui/components/data-table";
import { Skeleton } from "@/modules/ui/components/skeleton";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/modules/ui/components/table";

interface ResponseTableProps {
  data: TResponseTableData[];
  survey: TSurvey;
  responses: TResponseWithQuotas[] | null;
  environment: TEnvironment;
  user?: TUser;
  environmentTags: TTag[];
  isReadOnly: boolean;
  fetchNextPage: () => void;
  hasMore: boolean;
  updateResponseList: (responseIds: string[]) => void;
  updateResponse: (responseId: string, updatedResponse: TResponseWithQuotas) => void;
  isFetchingFirstPage: boolean;
  locale: TUserLocale;
  isQuotasAllowed: boolean;
  quotas: TSurveyQuota[];
}

export const ResponseTable = ({
  data,
  survey,
  responses,
  user,
  environment,
  environmentTags,
  isReadOnly,
  fetchNextPage,
  hasMore,
  updateResponseList,
  updateResponse,
  isFetchingFirstPage,
  locale,
  isQuotasAllowed,
  quotas,
}: ResponseTableProps) => {
  const { t } = useTranslate();
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [isTableSettingsModalOpen, setIsTableSettingsModalOpen] = useState(false);
  const [selectedResponseId, setSelectedResponseId] = useState<string | null>(null);
  const selectedResponse = responses?.find((response) => response.id === selectedResponseId) ?? null;
  const [isExpanded, setIsExpanded] = useState<boolean | null>(null);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [parent] = useAutoAnimate();

  const showQuotasColumn = isQuotasAllowed && quotas.length > 0;
  // Generate columns
  const columns = generateResponseTableColumns(survey, isExpanded ?? false, isReadOnly, t, showQuotasColumn);

  // Save settings to localStorage when they change
  useEffect(() => {
    if (columnOrder.length > 0) {
      localStorage.setItem(`${survey.id}-columnOrder`, JSON.stringify(columnOrder));
    }
    if (Object.keys(columnVisibility).length > 0) {
      localStorage.setItem(`${survey.id}-columnVisibility`, JSON.stringify(columnVisibility));
    }
    if (isExpanded !== null) {
      localStorage.setItem(`${survey.id}-rowExpand`, JSON.stringify(isExpanded));
    }
  }, [columnOrder, columnVisibility, isExpanded, survey.id]);

  // Initialize DnD sensors
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  );

  // Memoize table data and columns
  const tableData: TResponseTableData[] = useMemo(
    () => (isFetchingFirstPage ? Array(10).fill({}) : data),
    [data, isFetchingFirstPage]
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
    [columns, isFetchingFirstPage]
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

  const defaultColumnOrder = useMemo(() => table.getAllLeafColumns().map((d) => d.id), [table]);

  // Modified useEffect
  useEffect(() => {
    const savedColumnOrder = localStorage.getItem(`${survey.id}-columnOrder`);
    const savedColumnVisibility = localStorage.getItem(`${survey.id}-columnVisibility`);
    const savedExpandedSettings = localStorage.getItem(`${survey.id}-rowExpand`);

    if (savedColumnOrder && JSON.parse(savedColumnOrder).length > 0) {
      setColumnOrder(JSON.parse(savedColumnOrder));
    } else {
      setColumnOrder(defaultColumnOrder);
    }

    if (savedColumnVisibility) {
      setColumnVisibility(JSON.parse(savedColumnVisibility));
    }
    if (savedExpandedSettings !== null) {
      setIsExpanded(JSON.parse(savedExpandedSettings));
    }
  }, [survey.id, defaultColumnOrder]);

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

  const deleteResponse = async (responseId: string, params?: { decrementQuotas?: boolean }) => {
    await deleteResponseAction({ responseId, decrementQuotas: params?.decrementQuotas ?? false });
  };

  // Handle downloading selected responses
  const downloadSelectedRows = async (responseIds: string[], format: "csv" | "xlsx") => {
    try {
      const downloadResponse = await getResponsesDownloadUrlAction({
        surveyId: survey.id,
        format: format,
        filterCriteria: { responseIds },
      });

      if (downloadResponse?.data) {
        downloadResponsesFile(downloadResponse.data.fileName, downloadResponse.data.fileContents, format);
      } else {
        toast.error(t("environments.surveys.responses.error_downloading_responses"));
      }
    } catch (error) {
      Sentry.captureException(error);
      toast.error(t("environments.surveys.responses.error_downloading_responses"));
    }
  };

  return (
    <div>
      <DndContext
        id="response-table"
        collisionDetection={closestCenter}
        modifiers={[restrictToHorizontalAxis]}
        onDragEnd={handleDragEnd}
        sensors={sensors}>
        <DataTableToolbar
          setIsExpanded={setIsExpanded}
          setIsTableSettingsModalOpen={setIsTableSettingsModalOpen}
          isExpanded={isExpanded ?? false}
          table={table}
          updateRowList={updateResponseList}
          type="response"
          deleteAction={deleteResponse}
          downloadRowsAction={downloadSelectedRows}
          isQuotasAllowed={isQuotasAllowed}
        />
        <div className="w-fit max-w-full overflow-hidden overflow-x-auto rounded-xl border border-slate-200">
          <div className="w-full overflow-x-auto">
            <Table className="w-full" style={{ tableLayout: "fixed" }} id="response-table">
              <TableHeader className="pointer-events-auto">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
                      {headerGroup.headers.map((header) => (
                        <DataTableHeader
                          key={header.id}
                          header={header}
                          setIsTableSettingsModalOpen={setIsTableSettingsModalOpen}
                        />
                      ))}
                    </SortableContext>
                  </TableRow>
                ))}
              </TableHeader>

              <TableBody ref={parent}>
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
                        isExpanded={isExpanded ?? false}
                        setSelectedResponseId={setSelectedResponseId}
                        responses={responses}
                      />
                    ))}
                  </TableRow>
                ))}
                {table.getRowModel().rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      {t("common.no_results")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {data && hasMore && data.length > 0 && (
          <div className="mt-4 flex justify-center">
            <Button onClick={fetchNextPage}>{t("common.load_more")}</Button>
          </div>
        )}

        <DataTableSettingsModal
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
            isReadOnly={isReadOnly}
            updateResponse={updateResponse}
            updateResponseList={updateResponseList}
            setSelectedResponseId={setSelectedResponseId}
            selectedResponseId={selectedResponseId}
            open={selectedResponse !== null}
            locale={locale}
            setOpen={(open) => {
              if (!open) {
                setSelectedResponseId(null);
              }
            }}
          />
        )}
      </DndContext>
    </div>
  );
};
