"use client";

import { Table } from "@tanstack/react-table";
import { MoveVerticalIcon, RefreshCcwIcon, SettingsIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { SelectedRowSettings } from "./selected-row-settings";

interface DataTableToolbarProps<T> {
  setIsTableSettingsModalOpen: (isTableSettingsModalOpen: boolean) => void;
  setIsExpanded: (isExpanded: boolean) => void;
  isExpanded: boolean;
  table: Table<T>;
  updateRowList: (rowIds: string[]) => void;
  type: "response" | "contact";
  deleteAction: (id: string, params?: Record<string, boolean>) => Promise<void>;
  downloadRowsAction?: (rowIds: string[], format: string) => Promise<void>;
  isQuotasAllowed: boolean;
}

export const DataTableToolbar = <T,>({
  setIsExpanded,
  setIsTableSettingsModalOpen,
  isExpanded,
  table,
  updateRowList,
  type,
  deleteAction,
  downloadRowsAction,
  isQuotasAllowed,
}: DataTableToolbarProps<T>) => {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <div className="sticky top-0 z-30 flex w-full items-center justify-between bg-slate-50 py-2">
      {table.getFilteredSelectedRowModel().rows.length > 0 ? (
        <SelectedRowSettings
          table={table}
          updateRowList={updateRowList}
          type={type}
          deleteAction={deleteAction}
          downloadRowsAction={downloadRowsAction}
          isQuotasAllowed={isQuotasAllowed}
        />
      ) : (
        <div></div>
      )}
      <div className="flex space-x-2">
        {type === "contact" ? (
          <TooltipRenderer
            tooltipContent={t("environments.contacts.contacts_table_refresh")}
            shouldRender={true}>
            <button
              onClick={async () => {
                router.refresh();
                toast.success(t("environments.contacts.contacts_table_refresh_success"));
              }}
              className="cursor-pointer rounded-md border bg-white hover:border-slate-400">
              <RefreshCcwIcon strokeWidth={1.5} className={cn("m-1 h-6 w-6 p-0.5")} />
            </button>
          </TooltipRenderer>
        ) : null}

        <TooltipRenderer tooltipContent={t("common.table_settings")} shouldRender={true}>
          <button
            onClick={() => setIsTableSettingsModalOpen(true)}
            className="cursor-pointer rounded-md border bg-white hover:border-slate-400">
            <SettingsIcon strokeWidth={1.5} className="m-1 h-6 w-6 p-0.5" />
          </button>
        </TooltipRenderer>
        <TooltipRenderer
          tooltipContent={isExpanded ? t("common.collapse_rows") : t("common.expand_rows")}
          shouldRender={true}>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              "cursor-pointer rounded-md border bg-white hover:border-slate-400",
              isExpanded && "bg-black text-white"
            )}>
            <MoveVerticalIcon strokeWidth={1.5} className="m-1 h-6 w-6 p-0.5" />
          </button>
        </TooltipRenderer>
      </div>
    </div>
  );
};
