"use client";

import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { Table } from "@tanstack/react-table";
import { useTranslate } from "@tolgee/react";
import { MoveVerticalIcon, RefreshCcwIcon, SettingsIcon } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@formbricks/lib/cn";
import { SelectedRowSettings } from "./selected-row-settings";

interface DataTableToolbarProps<T> {
  setIsTableSettingsModalOpen: (isTableSettingsModalOpen: boolean) => void;
  setIsExpanded: (isExpanded: boolean) => void;
  isExpanded: boolean;
  table: Table<T>;
  deleteRows: (rowIds: string[]) => void;
  type: "response" | "contact";
  deleteAction: (id: string) => Promise<void>;
  refreshContacts?: () => Promise<void>;
}

export const DataTableToolbar = <T,>({
  setIsExpanded,
  setIsTableSettingsModalOpen,
  isExpanded,
  table,
  deleteRows,
  type,
  deleteAction,
  refreshContacts,
}: DataTableToolbarProps<T>) => {
  const { t } = useTranslate();

  return (
    <div className="sticky top-12 z-30 my-2 flex w-full items-center justify-between bg-slate-50 py-2">
      {table.getFilteredSelectedRowModel().rows.length > 0 ? (
        <SelectedRowSettings table={table} deleteRows={deleteRows} type={type} deleteAction={deleteAction} />
      ) : (
        <div></div>
      )}
      <div className="flex space-x-2">
        {type === "contact" ? (
          <TooltipRenderer
            tooltipContent={t("environments.contacts.contacts_table_refresh")}
            shouldRender={true}>
            <div
              onClick={async () => {
                if (refreshContacts) {
                  try {
                    await refreshContacts();
                    toast.success(t("environments.contacts.contacts_table_refresh_success"));
                  } catch (err) {
                    toast.error(t("environments.contacts.contacts_table_refresh_error"));
                  }
                }
              }}
              className="cursor-pointer rounded-md border bg-white hover:border-slate-400">
              <RefreshCcwIcon strokeWidth={1.5} className={cn("m-1 h-6 w-6 p-0.5")} />
            </div>
          </TooltipRenderer>
        ) : null}

        <TooltipRenderer tooltipContent={t("common.table_settings")} shouldRender={true}>
          <div
            onClick={() => setIsTableSettingsModalOpen(true)}
            className="cursor-pointer rounded-md border bg-white hover:border-slate-400">
            <SettingsIcon strokeWidth={1.5} className="m-1 h-6 w-6 p-0.5" />
          </div>
        </TooltipRenderer>
        <TooltipRenderer
          tooltipContent={isExpanded ? t("common.collapse_rows") : t("common.expand_rows")}
          shouldRender={true}>
          <div
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              "cursor-pointer rounded-md border bg-white hover:border-slate-400",
              isExpanded && "bg-black text-white"
            )}>
            <MoveVerticalIcon strokeWidth={1.5} className="m-1 h-6 w-6 p-0.5" />
          </div>
        </TooltipRenderer>
      </div>
    </div>
  );
};
