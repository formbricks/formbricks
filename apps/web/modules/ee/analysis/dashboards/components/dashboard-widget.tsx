"use client";

import {
  ChartColumnIcon,
  CopyIcon,
  Maximize2Icon,
  MoreVerticalIcon,
  SquarePenIcon,
  TableIcon,
  TrashIcon,
} from "lucide-react";
import { ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { type TWidgetView, WIDGET_VIEWS } from "@/modules/ee/analysis/dashboards/lib/widget-view";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

interface DashboardWidgetProps {
  title: string;
  children: ReactNode;
  isEditing?: boolean;
  /** Omitted for widgets with no data behind them (skeletons, load errors): no view to switch. */
  view?: TWidgetView;
  onViewChange?: (view: TWidgetView) => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onResize?: () => void;
  onRemove?: () => void;
}

export function DashboardWidget({
  title,
  children,
  isEditing,
  view,
  onViewChange,
  onEdit,
  onDuplicate,
  onResize,
  onRemove,
}: Readonly<DashboardWidgetProps>) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const hasMenuActions = Boolean(onEdit || onDuplicate || onResize || onRemove);

  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-lg border border-gray-200 bg-white shadow-xs ring-2 ring-transparent",
        isEditing && "ring-brand-dark/20 transition-shadow hover:ring-brand-dark/40"
      )}>
      <div
        className={cn(
          "flex min-h-10 items-center justify-between gap-2 border-b border-gray-100 px-4 py-1.5",
          isEditing && "rgl-drag-handle cursor-grab active:cursor-grabbing"
        )}>
        {/* A score card's title is the whole survey question, which does not fit one line in a
            quarter-width widget. Wrap to two lines and keep the full text in the native tooltip
            rather than clipping it mid-word. */}
        <h3 className="line-clamp-2 flex-1 text-sm leading-tight font-semibold text-gray-800" title={title}>
          {title}
        </h3>
        {view && onViewChange && (
          <div
            className="flex shrink-0 items-center rounded-md border border-gray-200 p-0.5"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}>
            {WIDGET_VIEWS.map((widgetView) => {
              const isActive = view === widgetView;
              const Icon = widgetView === "chart" ? ChartColumnIcon : TableIcon;
              const label =
                widgetView === "chart"
                  ? t("workspace.analysis.charts.chart")
                  : t("workspace.analysis.charts.chart_data_tab");
              return (
                <TooltipRenderer key={widgetView} tooltipContent={label}>
                  <button
                    type="button"
                    aria-label={label}
                    aria-pressed={isActive}
                    className={cn(
                      "flex items-center rounded-sm p-1 transition-colors",
                      isActive
                        ? "bg-gray-100 text-gray-700"
                        : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                    )}
                    onClick={() => onViewChange(widgetView)}>
                    <Icon className="size-3.5" />
                  </button>
                </TooltipRenderer>
              );
            })}
          </div>
        )}
        {hasMenuActions && (
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={t("common.more_options")}
                className="shrink-0 rounded-sm p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}>
                <MoreVerticalIcon className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {onEdit && (
                <DropdownMenuItem
                  onSelect={() => {
                    setMenuOpen(false);
                    onEdit();
                  }}>
                  <SquarePenIcon className="mr-2 size-4" />
                  {t("common.edit")}
                </DropdownMenuItem>
              )}
              {onDuplicate && (
                <DropdownMenuItem
                  onSelect={() => {
                    setMenuOpen(false);
                    onDuplicate();
                  }}>
                  <CopyIcon className="mr-2 size-4" />
                  {t("common.duplicate")}
                </DropdownMenuItem>
              )}
              {onResize && (
                <DropdownMenuItem
                  onSelect={() => {
                    setMenuOpen(false);
                    onResize();
                  }}>
                  <Maximize2Icon className="mr-2 size-4" />
                  {t("common.resize")}
                </DropdownMenuItem>
              )}
              {onRemove && (
                <DropdownMenuItem
                  onSelect={() => {
                    setMenuOpen(false);
                    onRemove();
                  }}
                  className="text-red-600 focus:text-red-600">
                  <TrashIcon className="mr-2 size-4" />
                  {t("common.remove")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <div className="relative flex-1 overflow-hidden p-4">{children}</div>
    </div>
  );
}
