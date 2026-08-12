"use client";

import { ChevronDownIcon, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";

interface SettingsSectionHeaderProps {
  label: string;
  isCollapsed: boolean;
  isTextVisible: boolean;
  switcherName?: string;
  switcherItems?: { id: string; name: string }[];
  isLoadingSwitcher?: boolean;
  errorSwitcher?: string | null;
  onSwitcherRetry?: () => void;
  currentId?: string;
  onSwitcherChange?: (id: string) => void;
  onSwitcherOpen?: () => void;
}

// The uppercase section label, plus the switcher pill when the section has something to switch
// between (the Account section has no pill, so it passes no switcher props at all).
export const SettingsSectionHeader = ({
  label,
  isCollapsed,
  isTextVisible,
  switcherName,
  switcherItems,
  isLoadingSwitcher,
  errorSwitcher,
  onSwitcherRetry,
  currentId,
  onSwitcherChange,
  onSwitcherOpen,
}: Readonly<SettingsSectionHeaderProps>) => {
  const { t } = useTranslation();

  const renderSwitcherContent = () => {
    if (isLoadingSwitcher) {
      return (
        <div className="flex items-center justify-center py-2">
          <Loader2 className="size-4 animate-spin" />
        </div>
      );
    }

    if (errorSwitcher) {
      return (
        <div className="px-2 py-4 text-center">
          <p className="mb-2 text-sm text-red-600">{errorSwitcher}</p>
          <button
            type="button"
            onClick={onSwitcherRetry}
            className="text-xs text-slate-600 underline hover:text-slate-800">
            {t("common.try_again")}
          </button>
        </div>
      );
    }

    return (
      <DropdownMenuGroup className="overflow-y-auto">
        {switcherItems?.map((item) => (
          <DropdownMenuCheckboxItem
            key={item.id}
            checked={item.id === currentId}
            onClick={() => onSwitcherChange?.(item.id)}
            className="cursor-pointer text-sm">
            {item.name}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuGroup>
    );
  };

  if (isCollapsed) {
    return null;
  }

  return (
    <div
      className={cn(
        "mt-4 mb-1 flex min-w-0 items-center gap-2 px-4",
        isTextVisible ? "opacity-0" : "opacity-100"
      )}>
      <span className="shrink-0 text-xs font-semibold tracking-wider text-slate-500 uppercase">{label}</span>
      {switcherName && switcherItems && onSwitcherChange && (
        <DropdownMenu onOpenChange={(open) => open && onSwitcherOpen?.()}>
          <DropdownMenuTrigger className="ml-auto flex max-w-[50%] min-w-0 items-center gap-1 rounded-md border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50">
            <span className="truncate">{switcherName}</span>
            <ChevronDownIcon className="size-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-[300px]">
            {renderSwitcherContent()}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};
