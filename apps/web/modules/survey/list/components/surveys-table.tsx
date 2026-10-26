"use client";

import { type ColumnDef, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import type { TFunction } from "i18next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TSurveyStatus, TSurveyVisibility } from "@formbricks/types/surveys/types";
import type { TUserLocale } from "@formbricks/types/user";
import { timeSince } from "@/lib/time";
import { formatDateForDisplay } from "@/lib/utils/datetime";
import { SurveyTypeIndicator } from "@/modules/survey/list/components/survey-type-indicator";
import type { surveyKeys } from "@/modules/survey/list/lib/query";
import type { TSurveyListItem } from "@/modules/survey/list/types/survey-overview";
import { getRestrictedAuthor } from "@/modules/survey/visibility/lib/collaborate";
import type { TSurveyVisibilityUiGate } from "@/modules/survey/visibility/lib/state";
import { ListTable } from "@/modules/ui/components/table-toolbar";
import type { TColumnLabel } from "@/modules/ui/components/table-toolbar/lib/column-settings";
import { SurveyDropDownMenu } from "./survey-dropdown-menu";
import { MakeVisibleStrip, SurveyNameCell, SurveyStatusPill, getSurveyRowState } from "./survey-row";

/** The columns the gear lists, in their default order. Name is locked; the row menu is not listed. */
export const getSurveyColumnLabels = (t: TFunction): TColumnLabel[] => [
  { id: "name", label: t("common.name") },
  { id: "status", label: t("common.status") },
  { id: "responses", label: t("workspace.surveys.completed_responses") },
  { id: "type", label: t("common.type") },
  { id: "createdAt", label: t("common.created_at") },
  { id: "updatedAt", label: t("common.updated_at") },
  { id: "createdBy", label: t("common.created_by") },
];

export const SURVEY_TABLE_COLUMN_IDS = [
  "name",
  "status",
  "responses",
  "type",
  "createdAt",
  "updatedAt",
  "createdBy",
  "actions",
];

type TSurveysTableProps = {
  surveys: TSurveyListItem[];
  isLoading: boolean;
  hasFilters: boolean;
  onClearFilters: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  columnOrder: string[];
  columnVisibility: Record<string, boolean>;
  workspaceBasePath: string;
  workspaceName: string;
  publicDomain: string;
  isReadOnly: boolean;
  locale: TUserLocale;
  surveyVisibilityGate: TSurveyVisibilityUiGate;
  listQueryKey: ReturnType<typeof surveyKeys.list>;
  deleteSurvey: (surveyId: string) => Promise<void>;
  updateSurveyStatus: (surveyId: string, status: TSurveyStatus) => Promise<void>;
  archiveSurvey: (surveyId: string) => Promise<void>;
  restoreSurvey: (surveyId: string) => Promise<void>;
  renameSurvey: (surveyId: string, name: string) => Promise<void>;
  updateSurveyVisibility: (surveyId: string, visibility: TSurveyVisibility) => Promise<void>;
  onVisibilityNotEnabled: () => void;
};

type TSurveyColumnContext = Pick<
  TSurveysTableProps,
  | "workspaceName"
  | "locale"
  | "publicDomain"
  | "isReadOnly"
  | "deleteSurvey"
  | "updateSurveyStatus"
  | "archiveSurvey"
  | "restoreSurvey"
  | "renameSurvey"
  | "surveyVisibilityGate"
  | "listQueryKey"
  | "onVisibilityNotEnabled"
> & { t: TFunction; rowStates: Map<string, ReturnType<typeof getSurveyRowState>> };

/** The table's columns, built outside the component so each cell renderer is not a nested component. */
const getSurveyColumns = ({
  t,
  rowStates,
  workspaceName,
  locale,
  publicDomain,
  isReadOnly,
  deleteSurvey,
  updateSurveyStatus,
  archiveSurvey,
  restoreSurvey,
  renameSurvey,
  surveyVisibilityGate,
  listQueryKey,
  onVisibilityNotEnabled,
}: TSurveyColumnContext): ColumnDef<TSurveyListItem>[] => [
  {
    id: "name",
    header: t("common.name"),
    meta: { label: t("common.name") },
    size: 260,
    cell: ({ row }) => {
      const state = rowStates.get(row.original.id);
      const nameCell = (
        <SurveyNameCell
          name={row.original.name}
          marker={state?.visibilityMarker ?? null}
          workspaceName={workspaceName}
          author={getRestrictedAuthor(row.original.access, row.original.owner?.name ?? null)}
        />
      );
      // The name is the row's link, so the row opens with a keyboard and in a new tab too.
      return state?.href ? (
        <Link
          href={state.href}
          className="focus-visible:ring-ring flex min-w-0 items-center gap-1 font-medium text-slate-900 hover:underline focus-visible:ring-1 focus-visible:outline-hidden">
          {nameCell}
        </Link>
      ) : (
        <div className="flex min-w-0 items-center gap-1 font-medium text-slate-900">{nameCell}</div>
      );
    },
  },
  {
    id: "status",
    header: t("common.status"),
    meta: { label: t("common.status") },
    size: 140,
    cell: ({ row }) => {
      const state = rowStates.get(row.original.id);
      return (
        <SurveyStatusPill
          status={row.original.status}
          isArchived={state?.isArchived ?? false}
          isScheduled={state?.isScheduled ?? false}
        />
      );
    },
  },
  {
    id: "responses",
    header: t("workspace.surveys.completed_responses"),
    meta: { label: t("workspace.surveys.completed_responses") },
    size: 110,
    cell: ({ row }) => <span className="text-slate-900">{row.original.completedResponseCount}</span>,
  },
  {
    id: "type",
    header: t("common.type"),
    meta: { label: t("common.type") },
    size: 100,
    cell: ({ row }) => <SurveyTypeIndicator type={row.original.type} />,
  },
  {
    id: "createdAt",
    header: t("common.created_at"),
    meta: { label: t("common.created_at") },
    size: 150,
    cell: ({ row }) => (
      <span className="truncate text-slate-500">{formatDateForDisplay(row.original.createdAt, locale)}</span>
    ),
  },
  {
    id: "updatedAt",
    header: t("common.updated_at"),
    meta: { label: t("common.updated_at") },
    size: 150,
    cell: ({ row }) => (
      <span className="truncate text-slate-500">{timeSince(row.original.updatedAt.toString(), locale)}</span>
    ),
  },
  {
    id: "createdBy",
    header: t("common.created_by"),
    meta: { label: t("common.created_by") },
    size: 150,
    cell: ({ row }) => <span className="truncate text-slate-500">{row.original.creator?.name ?? "—"}</span>,
  },
  {
    id: "actions",
    header: () => <span className="sr-only">{t("common.actions")}</span>,
    size: 64,
    cell: ({ row }) => (
      <div className="flex w-full justify-end">
        <SurveyDropDownMenu
          survey={row.original}
          publicDomain={publicDomain}
          disabled={rowStates.get(row.original.id)?.isDropdownDisabled}
          isSurveyCreationDeletionDisabled={isReadOnly}
          isReadOnly={isReadOnly}
          deleteSurvey={deleteSurvey}
          updateSurveyStatus={updateSurveyStatus}
          archiveSurvey={archiveSurvey}
          restoreSurvey={restoreSurvey}
          renameSurvey={renameSurvey}
          surveyVisibilityGate={surveyVisibilityGate}
          workspaceName={workspaceName}
          listQueryKey={listQueryKey}
          onVisibilityNotEnabled={onVisibilityNotEnabled}
        />
      </div>
    ),
  },
];

/** The Survey list as a real table (ENG-3541), so its columns can be shown, hidden and reordered. */
export const SurveysTable = ({
  surveys,
  isLoading,
  hasFilters,
  onClearFilters,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  columnOrder,
  columnVisibility,
  workspaceBasePath,
  workspaceName,
  publicDomain,
  isReadOnly,
  locale,
  surveyVisibilityGate,
  listQueryKey,
  deleteSurvey,
  updateSurveyStatus,
  archiveSurvey,
  restoreSurvey,
  renameSurvey,
  updateSurveyVisibility,
  onVisibilityNotEnabled,
}: Readonly<TSurveysTableProps>) => {
  const { t } = useTranslation();
  const router = useRouter();

  const rowStates = useMemo(
    () =>
      new Map(
        surveys.map((survey) => [
          survey.id,
          getSurveyRowState({ survey, isReadOnly, surveyVisibilityGate, workspaceBasePath }),
        ])
      ),
    [surveys, isReadOnly, surveyVisibilityGate, workspaceBasePath]
  );

  const columns = useMemo(
    () =>
      getSurveyColumns({
        t,
        rowStates,
        workspaceName,
        locale,
        publicDomain,
        isReadOnly,
        deleteSurvey,
        updateSurveyStatus,
        archiveSurvey,
        restoreSurvey,
        renameSurvey,
        surveyVisibilityGate,
        listQueryKey,
        onVisibilityNotEnabled,
      }),
    [
      t,
      rowStates,
      workspaceName,
      locale,
      publicDomain,
      isReadOnly,
      deleteSurvey,
      updateSurveyStatus,
      archiveSurvey,
      restoreSurvey,
      renameSurvey,
      surveyVisibilityGate,
      listQueryKey,
      onVisibilityNotEnabled,
    ]
  );

  const table = useReactTable({
    data: surveys,
    columns,
    getRowId: (survey) => survey.id,
    getCoreRowModel: getCoreRowModel(),
    state: { columnOrder, columnVisibility },
  });

  return (
    <ListTable
      table={table}
      testId="survey-list-table"
      isLoading={isLoading}
      hasFilters={hasFilters}
      onClearFilters={onClearFilters}
      isRowClickable={(row) => Boolean(rowStates.get(row.original.id)?.href)}
      onRowClick={(row) => {
        const href = rowStates.get(row.original.id)?.href;
        if (href) router.push(href);
      }}
      renderRowAddon={(row) =>
        rowStates.get(row.original.id)?.canMakeVisible ? (
          <MakeVisibleStrip
            surveyId={row.original.id}
            workspaceName={workspaceName}
            updateSurveyVisibility={updateSurveyVisibility}
            onVisibilityNotEnabled={onVisibilityNotEnabled}
          />
        ) : null
      }
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      onLoadMore={onLoadMore}
    />
  );
};
