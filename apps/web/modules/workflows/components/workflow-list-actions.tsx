"use client";

import { CopyIcon, MoreVertical, SquarePenIcon, TrashIcon } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";

interface WorkflowListActionsProps {
  workflowId: string;
  workspaceId: string;
}

export const WorkflowListActions = ({ workflowId, workspaceId }: Readonly<WorkflowListActionsProps>) => {
  const { t } = useTranslation();

  return (
    <div id={`${workflowId}-workflow-actions`} data-testid="workflow-dropdown-menu">
      <DropdownMenu>
        <DropdownMenuTrigger className="z-10" asChild>
          <button
            type="button"
            data-testid="workflow-dropdown-trigger"
            aria-label={t("common.open_options")}
            className="cursor-pointer rounded-lg border bg-white p-2 hover:bg-slate-50">
            <span className="sr-only">{t("common.open_options")}</span>
            <MoreVertical className="size-4" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="inline-block w-auto min-w-max">
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link
                className="flex w-full items-center"
                href={`/workspaces/${workspaceId}/workflows/${workflowId}`}>
                <SquarePenIcon className="mr-2 size-4" />
                {t("common.edit")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <div className="flex w-full items-center opacity-50">
                <CopyIcon className="mr-2 size-4" />
                {t("common.duplicate")}
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <div className="flex w-full items-center opacity-50">
                <TrashIcon className="mr-2 size-4" />
                {t("common.delete")}
              </div>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
