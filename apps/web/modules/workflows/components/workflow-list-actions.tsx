"use client";

import { CopyIcon, MoreVertical, SquarePenIcon, TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();

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
            <DropdownMenuItem
              icon={<SquarePenIcon className="size-4" />}
              onSelect={() => router.push(`/workspaces/${workspaceId}/workflows/${workflowId}`)}>
              {t("common.edit")}
            </DropdownMenuItem>
            <DropdownMenuItem disabled icon={<CopyIcon className="size-4" />}>
              {t("common.duplicate")}
            </DropdownMenuItem>
            <DropdownMenuItem disabled icon={<TrashIcon className="size-4" />}>
              {t("common.delete")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
