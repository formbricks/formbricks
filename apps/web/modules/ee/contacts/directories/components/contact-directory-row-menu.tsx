"use client";

import { MoreVertical, SquarePenIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";

/** The ⋮ menu at the end of a directory row. Manage is its one item in this release. */
export const ContactDirectoryRowMenu = ({ onManage }: Readonly<{ onManage: () => void }>) => {
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="cursor-pointer rounded-lg border bg-white p-2 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-hidden"
        onKeyDown={(event) => event.stopPropagation()}>
        <span className="sr-only">{t("workspace.surveys.open_options")}</span>
        <MoreVertical className="size-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onManage}>
          <SquarePenIcon className="mr-2 size-4" aria-hidden="true" />
          {t("common.manage")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
