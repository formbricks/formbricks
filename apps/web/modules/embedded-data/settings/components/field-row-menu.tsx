"use client";

import { MoreVertical, SquarePenIcon, TrashIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";

interface FieldRowMenuProps {
  fieldName: string;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * The row's own menu. Clicking a row edits it, so this repeats Edit rather than only offering
 * Delete: a row reached from the keyboard has no hover target, and the menu is where the two actions
 * are discoverable together.
 */
export const FieldRowMenu = ({ fieldName, onEdit, onDelete }: Readonly<FieldRowMenuProps>) => {
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        // `hover:bg-slate-100`, not `slate-50`: the row itself hovers to `slate-50`, so matching it
        // left the trigger with no hover feedback at the moment it is hovered. `size-9` is the
        // icon-button floor.
        className="flex size-9 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-100">
        {/* Names the field, so a screen reader reading the column does not hear the same button twice. */}
        <span className="sr-only">{`${t("workspace.surveys.open_options")} – ${fieldName}`}</span>
        <MoreVertical className="size-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="inline-block w-auto min-w-max">
        <DropdownMenuGroup>
          <DropdownMenuItem icon={<SquarePenIcon className="size-4" />} onSelect={onEdit}>
            {t("common.edit")}
          </DropdownMenuItem>
          <DropdownMenuItem icon={<TrashIcon className="size-4" />} onSelect={onDelete}>
            {t("common.delete")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
