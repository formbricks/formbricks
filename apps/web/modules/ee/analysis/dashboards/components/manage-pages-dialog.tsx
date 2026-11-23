"use client";

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TDashboardPageAccess } from "@/modules/ee/analysis/lib/api-client";
import type { TDashboardPage } from "@/modules/ee/analysis/types/analysis";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { InfoTooltip } from "@/modules/ui/components/info-tooltip";
import { AllChipMultiSelect } from "@/modules/ui/components/multi-select/all-chip-multi-select";
import { PageNameInput } from "./page-name-input";

interface ManagePagesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pages: TDashboardPage[];
  onAddPage: () => void;
  onRenamePage: (pageId: string, name: string) => void;
  onMovePage: (activeId: string, overId: string) => void;
  /** Asks to delete a page; the caller confirms first. */
  onDeletePage: (pageId: string) => void;
  onTeamsChange: (pageId: string, teamIds: string[]) => void;
  /** From the server; while it loads, or for someone who may not change limits, the pickers are read-only. */
  access: TDashboardPageAccess | undefined;
}

function PageRow({
  page,
  canDelete,
  access,
  onRenamePage,
  onDeletePage,
  onTeamsChange,
}: Readonly<{
  page: TDashboardPage;
  canDelete: boolean;
  access: TDashboardPageAccess | undefined;
  onRenamePage: ManagePagesDialogProps["onRenamePage"];
  onDeletePage: ManagePagesDialogProps["onDeletePage"];
  onTeamsChange: ManagePagesDialogProps["onTeamsChange"];
}>) {
  const { t } = useTranslation();
  const [isRenaming, setIsRenaming] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: page.id,
  });
  const teams = access?.teams ?? [];

  return (
    <tr
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        zIndex: isDragging ? 10 : undefined,
      }}
      className="relative border-b border-slate-100 bg-white last:border-b-0">
      <td className="w-8 py-2 pl-2 align-top">
        <button
          type="button"
          className="mt-1.5 flex size-6 cursor-grab items-center justify-center rounded text-slate-400 hover:text-slate-700 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden active:cursor-grabbing"
          aria-label={t("workspace.analysis.dashboards.reorder_page", { page: page.name })}
          {...attributes}
          {...listeners}>
          <GripVerticalIcon className="size-4" />
        </button>
      </td>
      <td className="w-1/3 py-2 pr-3 align-top">
        {isRenaming ? (
          <PageNameInput
            className="mt-1 w-full"
            initialName={page.name}
            onSubmit={(name) => {
              onRenamePage(page.id, name);
              setIsRenaming(false);
            }}
            onCancel={() => setIsRenaming(false)}
          />
        ) : (
          <button
            type="button"
            title={t("common.rename")}
            className="mt-1.5 max-w-full truncate rounded px-1 text-left text-sm font-medium text-slate-800 hover:bg-slate-100"
            onClick={() => setIsRenaming(true)}>
            {page.name}
          </button>
        )}
      </td>
      <td className="py-2 pr-2 align-top">
        <AllChipMultiSelect
          ariaLabel={t("workspace.analysis.dashboards.page_visible_to", { page: page.name })}
          allLabel={t("workspace.analysis.dashboards.all_teams")}
          placeholder={t("workspace.analysis.dashboards.select_teams")}
          options={teams.map((team) => ({ value: team.id, label: team.name, disabled: !team.selectable }))}
          value={page.teamIds}
          onChange={(teamIds) => onTeamsChange(page.id, teamIds)}
          disabled={!access?.canManageAccess}
        />
      </td>
      <td className="w-10 py-2 pr-2 align-top">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="mt-0.5"
          disabled={!canDelete}
          aria-label={t("workspace.analysis.dashboards.delete_page", { page: page.name })}
          onClick={() => onDeletePage(page.id)}>
          <TrashIcon />
        </Button>
      </td>
    </tr>
  );
}

/**
 * Manage pages (ENG-7480, ENG-7481): rename, reorder by drag, delete, and limit which Dashboard Viewers see
 * each page. Every change goes into the edit's draft and is saved with the dashboard. The team picker is
 * enabled only for whom the server says may change it; everyone else sees the limits as chips.
 */
export function ManagePagesDialog({
  open,
  onOpenChange,
  pages,
  onAddPage,
  onRenamePage,
  onMovePage,
  onDeletePage,
  onTeamsChange,
  access,
}: Readonly<ManagePagesDialogProps>) {
  const { t } = useTranslation();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) onMovePage(String(active.id), String(over.id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent width="wide">
        <DialogHeader>
          <DialogTitle>{t("workspace.analysis.dashboards.manage_pages")}</DialogTitle>
          <DialogDescription>{t("workspace.analysis.dashboards.manage_pages_description")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <table className="w-full table-fixed">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500">
                <th className="w-8" aria-hidden="true" />
                <th className="w-1/3 py-2 pr-3 font-medium">{t("workspace.analysis.dashboards.page")}</th>
                <th className="py-2 pr-2 font-medium">
                  <span className="inline-flex items-center gap-1">
                    {t("workspace.analysis.dashboards.visible_to_dashboard_viewers_in")}
                    <InfoTooltip label={t("workspace.analysis.dashboards.page_limits_info_label")}>
                      {t("workspace.analysis.dashboards.page_limits_info")}
                    </InfoTooltip>
                  </span>
                </th>
                <th className="w-10" aria-hidden="true" />
              </tr>
            </thead>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis]}
              onDragEnd={handleDragEnd}>
              <SortableContext items={pages.map((page) => page.id)} strategy={verticalListSortingStrategy}>
                <tbody>
                  {pages.map((page) => (
                    <PageRow
                      key={page.id}
                      page={page}
                      canDelete={pages.length > 1}
                      access={access}
                      onRenamePage={onRenamePage}
                      onDeletePage={onDeletePage}
                      onTeamsChange={onTeamsChange}
                    />
                  ))}
                </tbody>
              </SortableContext>
            </DndContext>
          </table>
        </DialogBody>
        <DialogFooter className="sm:justify-between">
          <Button type="button" variant="secondary" onClick={onAddPage}>
            <PlusIcon />
            {t("workspace.analysis.dashboards.add_page")}
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)}>
            {t("common.done")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
