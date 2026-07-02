"use client";

import { Building2Icon, FoldersIcon, Loader2, SettingsIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useTranslation } from "react-i18next";
import type { SwitcherItem } from "@/modules/settings/hooks/use-switcher-data";
import {
  DropdownMenuCheckboxItem,
  DropdownMenuGroup,
  DropdownMenuSeparator,
} from "@/modules/ui/components/dropdown-menu";

type SwitcherType = "organization" | "workspace";

const SWITCHER_CONFIG: Record<
  SwitcherType,
  { icon: typeof Building2Icon; settingsPath: (id: string) => string }
> = {
  organization: {
    icon: Building2Icon,
    settingsPath: (id) => `/organizations/${id}/settings/general`,
  },
  workspace: {
    icon: FoldersIcon,
    settingsPath: (id) => `/workspaces/${id}/settings/workspace/general`,
  },
};

interface SwitcherDropdownBodyProps {
  type: SwitcherType;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  items: SwitcherItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  // Optional content rendered after the list, only in the loaded/no-error state (e.g. an
  // "add workspace" action).
  children?: React.ReactNode;
  // Renders a separator + "Settings" item for the current entity (routes off type + selectedId).
  // Defaults to true; pass false where the settings link is rendered separately.
  showSettings?: boolean;
}

// The shared body of an organization / workspace switcher dropdown: header, loading spinner, load
// error with retry, the selectable list, and a Settings footer that navigates to the current
// entity's settings. Consumers own only the trigger, so the dropdown looks identical everywhere
// (left nav, breadcrumbs, landing).
export const SwitcherDropdownBody = ({
  type,
  isLoading,
  error,
  onRetry,
  items,
  selectedId,
  onSelect,
  children,
  showSettings = true,
}: Readonly<SwitcherDropdownBodyProps>) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { icon: Icon, settingsPath } = SWITCHER_CONFIG[type];
  const headerLabel =
    type === "organization" ? t("common.choose_organization") : t("common.choose_workspace");

  const goToSettings = () => {
    startTransition(() => {
      router.push(settingsPath(selectedId));
    });
  };

  return (
    <>
      <div className="px-2 py-1.5 text-sm font-medium text-slate-500">
        <Icon className="mr-2 inline size-4" strokeWidth={1.5} />
        {headerLabel}
      </div>
      {isLoading && (
        <div className="flex items-center justify-center py-2">
          <Loader2 className="size-4 animate-spin" />
        </div>
      )}
      {!isLoading && error && (
        <div className="px-2 py-4">
          <p className="mb-2 text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="text-xs text-slate-600 underline hover:text-slate-800">
            {t("common.try_again")}
          </button>
        </div>
      )}
      {!isLoading && !error && (
        <>
          <DropdownMenuGroup className="max-h-[300px] overflow-y-auto">
            {items.map((item) => (
              <DropdownMenuCheckboxItem
                key={item.id}
                checked={item.id === selectedId}
                onClick={() => onSelect(item.id)}
                className="cursor-pointer">
                {item.name}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuGroup>
          {children}
        </>
      )}
      {showSettings && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem onClick={goToSettings} className="cursor-pointer">
            <SettingsIcon className="mr-2 size-4" strokeWidth={1.5} />
            {t("common.settings")}
          </DropdownMenuCheckboxItem>
        </>
      )}
    </>
  );
};
