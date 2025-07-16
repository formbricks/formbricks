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
  environment: TEnvironment;
  /** Green dot + status text */
  statusNode: React.ReactNode;
  /** Reconnect button props */
  reconnectAction: ActionButtonProps;
  /** Add new mapping button props */
  addNewAction: ActionButtonProps;
  /** Empty state message */
  emptyMessage: string;
  /** Data rows */
  items: T[];
  /** Columns definition (max 3 for current UI) */
  columns: Column<T>[];
  /** Row click handler */
  onRowClick: (index: number) => void;
  /** Function to derive unique key for row */
  getRowKey?: (item: T, index: number) => string | number;
}

/**
 * Generic list panel used by integration manage pages to avoid repeating toolbar + table boilerplate.
 */
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
            {/* Header */}
            <div className="grid h-12 grid-cols-6 content-center rounded-lg bg-slate-100 text-left text-sm font-semibold text-slate-900">
              {columns.map((col, idx) => (
                <div key={`hdr-${idx}`} className="col-span-2 hidden text-center sm:block">
                  {col.header}
                </div>
              ))}
            </div>
            {/* Rows */}
            {items.map((item, index) => {
              const key = getRowKey ? getRowKey(item, index) : index;
              return (
                <button
                  key={key}
                  className="grid h-16 w-full cursor-pointer grid-cols-6 content-center rounded-lg p-2 hover:bg-slate-100"
                  onClick={() => onRowClick(index)}>
                  {columns.map((col, idx) => (
                    <div key={`cell-${idx}`} className="col-span-2 text-center">
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
