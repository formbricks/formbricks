"use client";

import { arrayMove } from "@dnd-kit/sortable";
import * as Sentry from "@sentry/nextjs";
import { VisibilityState, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TSurveyQuota } from "@formbricks/types/quota";
import { TResponseTableData, TResponseWithQuotas } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { TUser, TUserLocale } from "@formbricks/types/user";
import {
  ResponseToolbar,
  type TResponseToolbarState,
} from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/components/ResponseToolbar";
import { ResponseCardModal } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/responses/components/ResponseCardModal";
import { generateResponseTableColumns } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/responses/components/ResponseTableColumns";
import { getResponsesDownloadUrlAction } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/actions";
import { downloadResponsesFile } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/utils";
import { getFormattedErrorMessage } from "@/lib/utils/error-message";
import { deleteResponseAction } from "@/modules/analysis/components/SingleResponseCard/actions";
import { SelectedRowSettings } from "@/modules/ui/components/data-table/components/selected-row-settings";
import { ListTable } from "@/modules/ui/components/table-toolbar";
import { useColumnSizing } from "@/modules/ui/components/table-toolbar/hooks/use-table-column-state";
import { buildColumnSettings } from "@/modules/ui/components/table-toolbar/lib/column-settings";
import { reconcileColumnOrder, seedReservedColumnVisibility } from "../lib/column-state";

/** Pinned to the left while the table scrolls sideways, in this order. */
const PINNED_COLUMNS = ["select", "createdAt"];

interface ResponseTableProps {
  data: TResponseTableData[];
  survey: TSurvey;
  responses: TResponseWithQuotas[] | null;
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
  selectedResponseId: string | null;
  setSelectedResponseId: (id: string | null) => void;
  toolbar: TResponseToolbarState;
  /** Creatives open this survey: its table then shows "Opened by creative" by default. */
  isOpenedByCreatives: boolean;
}

/** The gear's column names: each column's text label, which its rendered header does not give. */
const getColumnLabels = (table: ReturnType<typeof useReactTable<TResponseTableData>>) =>
  table.getAllLeafColumns().flatMap((column) => {
    const label = (column.columnDef.meta as { label?: string } | undefined)?.label;
    return label ? [{ id: column.id, label }] : [];
  });

export const ResponseTable = ({
  data,
  survey,
  responses,
  user,
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
  selectedResponseId,
  setSelectedResponseId,
  toolbar,

  isOpenedByCreatives,
}: Readonly<ResponseTableProps>) => {
  const { t } = useTranslation();
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const selectedResponse = responses?.find((response) => response.id === selectedResponseId) ?? null;
  const [isExpanded, setIsExpanded] = useState<boolean | null>(null);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);

  const showQuotasColumn = isQuotasAllowed && quotas.length > 0;
  // Generate columns
  const columns = useMemo(
    () => generateResponseTableColumns(survey, isExpanded ?? false, isReadOnly, locale, t, showQuotasColumn),
    [survey, isExpanded, isReadOnly, locale, t, showQuotasColumn]
  );

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

  const sizing = useColumnSizing(`${survey.id}-columnSizing`);

  // React Table instance
  const table = useReactTable({
    data,
    columns,
    getRowId: (originalRow) => originalRow.responseId,
    getCoreRowModel: getCoreRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onColumnOrderChange: setColumnOrder,
    manualPagination: true,
    defaultColumn: { size: 300 },
    state: {
      columnOrder,
      columnVisibility,
      rowSelection,
      columnPinning: { left: PINNED_COLUMNS },
      columnSizing: sizing.columnSizing,
    },
    ...sizing.tableOptions,
  });

  const defaultColumnOrder = useMemo(() => table.getAllLeafColumns().map((d) => d.id), [table]);

  useEffect(() => {
    const savedColumnOrder = localStorage.getItem(`${survey.id}-columnOrder`);
    const savedColumnVisibility = localStorage.getItem(`${survey.id}-columnVisibility`);
    const savedExpandedSettings = localStorage.getItem(`${survey.id}-rowExpand`);

    // Reconciled rather than adopted wholesale (ENG-2540): the settings modal iterates THIS array, so
    // a column id the saved order has never seen used to get no toggle and no drag handle at all.
    const parsedOrder = savedColumnOrder ? (JSON.parse(savedColumnOrder) as string[]) : [];
    setColumnOrder(
      parsedOrder.length > 0 ? reconcileColumnOrder(parsedOrder, defaultColumnOrder) : defaultColumnOrder
    );

    // Seeded whether or not anything was saved: a reserved column absent from `columnVisibility` is
    // visible in TanStack, so the `secondary` ones need an explicit `false` to start hidden.
    setColumnVisibility(
      seedReservedColumnVisibility(
        savedColumnVisibility ? (JSON.parse(savedColumnVisibility) as VisibilityState) : {},
        { isOpenedByCreatives }
      )
    );

    if (savedExpandedSettings !== null) {
      setIsExpanded(JSON.parse(savedExpandedSettings));
    }
  }, [survey.id, defaultColumnOrder, isOpenedByCreatives]);

  const deleteResponse = async (responseId: string, params?: { decrementQuotas?: boolean }) => {
    const result = await deleteResponseAction({
      responseId,
      decrementQuotas: params?.decrementQuotas ?? false,
    });
    if (result?.serverError) {
      throw new Error(getFormattedErrorMessage(result));
    }
  };

  // Handle downloading selected responses
  const downloadSelectedRows = async (responseIds: string[], format: "xlsx" | "csv") => {
    try {
      const downloadResponse = await getResponsesDownloadUrlAction({
        surveyId: survey.id,
        format,
        filterCriteria: { responseIds },
      });

      if (downloadResponse?.data) {
        downloadResponsesFile(downloadResponse.data.fileName, downloadResponse.data.fileContents, format);
      } else {
        toast.error(t("workspace.surveys.responses.error_downloading_responses"));
      }
    } catch (error) {
      Sentry.captureException(error);
      toast.error(t("workspace.surveys.responses.error_downloading_responses"));
    }
  };

  return (
    <div>
      <ResponseToolbar
        survey={survey}
        {...toolbar}
        className="mb-3"
        settings={{
          toggles: [
            {
              id: "expand-rows",
              label: t("common.expand_rows"),
              checked: isExpanded ?? false,
              onCheckedChange: setIsExpanded,
            },
          ],
          columns: {
            items: buildColumnSettings(
              getColumnLabels(table),
              // Date is pinned to the left of the table, so it leads the gear's list too.
              ["createdAt", ...columnOrder.filter((id) => id !== "createdAt")],
              columnVisibility,
              ["createdAt"]
            ),
            onVisibilityChange: (id, visible) =>
              setColumnVisibility((current) => ({ ...current, [id]: visible })),
            onMove: (activeId, overId) =>
              setColumnOrder((order) => {
                const from = order.indexOf(activeId);
                const to = order.indexOf(overId);
                return from === -1 || to === -1 ? order : arrayMove(order, from, to);
              }),
          },
        }}
        selectionContent={
          table.getFilteredSelectedRowModel().rows.length > 0 ? (
            <SelectedRowSettings
              table={table}
              updateRowList={updateResponseList}
              type="response"
              deleteAction={deleteResponse}
              downloadRowsAction={downloadSelectedRows}
              isQuotasAllowed={isQuotasAllowed}
            />
          ) : undefined
        }
      />
      <ListTable
        table={table}
        testId="response-table"
        isLoading={isFetchingFirstPage}
        hasFilters={toolbar.filterState.hasFilters}
        onClearFilters={toolbar.filterState.clearFilters}
        // A row opens that response's card; its checkbox and links keep their own clicks.
        onRowClick={(row) => setSelectedResponseId(row.id)}
        isExpanded={isExpanded ?? false}
        hasNextPage={hasMore && data.length > 0}
        onLoadMore={fetchNextPage}
        pinnedColumnIds={PINNED_COLUMNS}
      />

      {responses && (
        <ResponseCardModal
          survey={survey}
          responses={responses}
          user={user}
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
    </div>
  );
};
