"use client";

import { Button } from "@/modules/ui/components/button";
import { EmptySpaceFiller } from "@/modules/ui/components/empty-space-filler";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";
import React from "react";
import { TEnvironment } from "@formbricks/types/environment";

interface Column<T> {
  /** Header text rendered in the table head */
  header: React.ReactNode;
  /** Cell renderer for an item */
  render: (item: T) => React.ReactNode;
}

interface ActionButtonProps {
  label: string;
  onClick: () => void;
  /** Optional Lucide Icon */
  icon?: React.ReactNode;
  /** Tooltip content */
  tooltip?: string;
  /** Variant override */
  variant?: "default" | "outline" | "secondary" | "destructive" | "ghost";
}

interface IntegrationListPanelProps<T> {
  readonly environment: TEnvironment;
  readonly statusNode: React.ReactNode;
  readonly reconnectAction: ActionButtonProps;
  readonly addNewAction: ActionButtonProps;
  readonly emptyMessage: string;
  readonly items: T[];
  readonly columns: Column<T>[];
  readonly onRowClick: (index: number) => void;
  readonly getRowKey?: (item: T, index: number) => string | number;
}

export function IntegrationListPanel<T>({
  environment,
  statusNode,
  reconnectAction,
  addNewAction,
  emptyMessage,
  items,
  columns,
  onRowClick,
  getRowKey,
}: IntegrationListPanelProps<T>) {
  return (
    <div className="mt-6 flex w-full flex-col items-center justify-center p-6">
      {/* Toolbar */}
      <div className="flex w-full justify-end space-x-2">
        <div className="mr-6 flex items-center">{statusNode}</div>

        {/* Re-connect */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant={reconnectAction.variant ?? "outline"} onClick={reconnectAction.onClick}>
                {reconnectAction.icon}
                {reconnectAction.label}
              </Button>
            </TooltipTrigger>
            {reconnectAction.tooltip && <TooltipContent>{reconnectAction.tooltip}</TooltipContent>}
          </Tooltip>
        </TooltipProvider>

        {/* Add new */}
        <Button variant={addNewAction.variant ?? "default"} onClick={addNewAction.onClick}>
          {addNewAction.icon}
          {addNewAction.label}
        </Button>
      </div>

      {/* Empty table view */}
      {!items || items.length === 0 ? (
        <div className="mt-4 w-full">
          <EmptySpaceFiller
            type="table"
            environment={environment}
            noWidgetRequired={true}
            emptyMessage={emptyMessage}
          />
        </div>
      ) : (
        <div className="mt-4 flex w-full flex-col items-center justify-center">
          <div className="mt-6 w-full rounded-lg border border-slate-200">
            <div className="grid h-12 grid-cols-6 content-center rounded-lg bg-slate-100 text-left text-sm font-semibold text-slate-900">
              {columns.map((col) => (
                <div key={`hdr-${String(col.header)}`} className="col-span-2 hidden text-center sm:block">
                  {col.header}
                </div>
              ))}
            </div>
            {items.map((item, index) => {
              const key = getRowKey ? getRowKey(item, index) : index;
              return (
                <button
                  key={key}
                  className="grid h-16 w-full cursor-pointer grid-cols-6 content-center rounded-lg p-2 hover:bg-slate-100"
                  onClick={() => onRowClick(index)}>
                  {columns.map((col) => (
                    <div key={`cell-${String(col.header)}`} className="col-span-2 text-center">
                      {col.render(item)}
                    </div>
                  ))}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
