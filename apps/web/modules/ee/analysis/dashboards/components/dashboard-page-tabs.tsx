"use client";

import { ChevronDownIcon, PencilIcon, PlusIcon, Settings2Icon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import type { TDashboardPage } from "@/modules/ee/analysis/types/analysis";
import { Button } from "@/modules/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { PageNameInput } from "./page-name-input";

interface DashboardPageTabsProps {
  pages: TDashboardPage[];
  selectedPageId: string | null;
  onSelect: (pageId: string) => void;
  isEditing: boolean;
  onAddPage: () => void;
  onRenamePage: (pageId: string, name: string) => void;
  /** Asks to delete a page; the caller confirms first. */
  onDeletePage: (pageId: string) => void;
  onManagePages: () => void;
}

/**
 * A dashboard's pages as tabs, styled like the app's secondary navigation (ENG-7480). Viewing, they are
 * only tabs, and a dashboard with one page shows none. Editing, each tab has a menu with Rename and Delete
 * (no Duplicate), a ghost "+" adds a page, and "Manage pages" opens the dialog.
 */
export function DashboardPageTabs({
  pages,
  selectedPageId,
  onSelect,
  isEditing,
  onAddPage,
  onRenamePage,
  onDeletePage,
  onManagePages,
}: Readonly<DashboardPageTabsProps>) {
  const { t } = useTranslation();
  const [renamingPageId, setRenamingPageId] = useState<string | null>(null);

  if (!isEditing && pages.length <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-200">
      <nav
        className="flex h-10 min-w-0 items-center gap-x-4 overflow-x-auto"
        aria-label={t("workspace.analysis.dashboards.pages")}>
        {pages.map((page) => {
          const isActive = page.id === selectedPageId;
          return (
            <div key={page.id} className="group flex h-full shrink-0 flex-col">
              <div className="flex h-full items-center">
                {renamingPageId === page.id ? (
                  <PageNameInput
                    initialName={page.name}
                    onSubmit={(name) => {
                      onRenamePage(page.id, name);
                      setRenamingPageId(null);
                    }}
                    onCancel={() => setRenamingPageId(null)}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelect(page.id)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex h-full max-w-56 items-center truncate px-3 text-sm font-medium",
                      isActive ? "font-semibold text-slate-900" : "text-slate-500 hover:text-slate-700"
                    )}>
                    <span className="truncate">{page.name}</span>
                  </button>
                )}
                {isEditing && renamingPageId !== page.id && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={t("workspace.analysis.dashboards.page_options", { page: page.name })}
                        className="-ml-2 rounded-sm p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                        <ChevronDownIcon className="size-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-40">
                      <DropdownMenuItem onSelect={() => setRenamingPageId(page.id)}>
                        <PencilIcon className="mr-2 size-4" />
                        {t("common.rename")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={pages.length <= 1}
                        onSelect={() => onDeletePage(page.id)}
                        className="text-red-600 focus:text-red-600">
                        <TrashIcon className="mr-2 size-4" />
                        {t("common.delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              <div
                className={cn(
                  "mt-auto h-[2px] w-full rounded-t-lg transition-all duration-150 ease-in-out",
                  isActive ? "bg-brand-dark" : "bg-transparent group-hover:bg-slate-300"
                )}
              />
            </div>
          );
        })}
        {isEditing && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0"
            aria-label={t("workspace.analysis.dashboards.add_page")}
            onClick={onAddPage}>
            <PlusIcon />
          </Button>
        )}
      </nav>
      {isEditing && (
        <Button type="button" variant="secondary" size="sm" className="shrink-0" onClick={onManagePages}>
          <Settings2Icon />
          {t("workspace.analysis.dashboards.manage_pages")}
        </Button>
      )}
    </div>
  );
}
