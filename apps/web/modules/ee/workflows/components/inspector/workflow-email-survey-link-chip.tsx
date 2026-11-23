"use client";

import { ClipboardCheckIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";

interface WorkflowEmailSurveyLinkChipProps {
  /** The linked survey's name; the generic "Survey link" while it loads or when none is linked. */
  label: string;
  /** What the link passes, e.g. "Passes customer_id and plan from this run." */
  description: string;
  isEditable: boolean;
  onEdit: () => void;
  onRemove: () => void;
}

const CHIP_CLASS_NAME =
  "inline-flex h-fit items-center gap-1 rounded-md bg-slate-100 px-1 text-sm whitespace-nowrap text-slate-700";

/**
 * The survey link in the message: the `#survey-link#` token drawn with the survey's name. Clicking
 * it offers Edit (the toolbar popover with this link) and Remove (the chip and the step's link
 * together).
 */
export const WorkflowEmailSurveyLinkChip = ({
  label,
  description,
  isEditable,
  onEdit,
  onRemove,
}: Readonly<WorkflowEmailSurveyLinkChipProps>) => {
  const { t } = useTranslation();
  const content = (
    <>
      <ClipboardCheckIcon className="size-3.5 shrink-0" aria-hidden="true" />
      {label}
    </>
  );

  if (!isEditable) {
    return (
      <span className={CHIP_CLASS_NAME} title={description}>
        {content}
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={`${CHIP_CLASS_NAME} cursor-pointer hover:bg-slate-200`}>
          {content}
        </button>
      </DropdownMenuTrigger>
      {/* Edit opens the toolbar's popover: handing focus back to the chip would close it again. */}
      <DropdownMenuContent
        align="start"
        className="w-64"
        onCloseAutoFocus={(event) => event.preventDefault()}>
        <p className="px-2 py-1.5 text-xs text-slate-500">{description}</p>
        <DropdownMenuItem onSelect={onEdit}>
          <PencilIcon className="mr-2 size-4" />
          {t("common.edit")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onRemove} className="text-red-600">
          <Trash2Icon className="mr-2 size-4" />
          {t("workspace.workflows.email_survey_link_remove")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
