"use client";

import Link from "next/link";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { deleteSharedEmbeddedDataAction } from "@/modules/embedded-data/actions";
import type { TEmbeddedDataUsageItem, TSharedEmbeddedData } from "@/modules/embedded-data/types";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { getSurveyStatusLabel } from "../lib/field-labels";

interface DeleteFieldDialogProps {
  field: TSharedEmbeddedData;
  workspaceId: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  onDeleted: () => void;
}

/**
 * Deleting a library field, and the refusal that is the point of it.
 *
 * `SurveyEmbeddedData` cascades, so removing a linked field would strip it from every survey using
 * it and leave the responses already stored under its `storageKey` addressed by a definition that no
 * longer exists. The service refuses that and answers with the surveys, which this names — **there is
 * no force-delete path**, on purpose: the remedy is to remove the field from those surveys first.
 *
 * The refusal is read from the write's result rather than pre-empted by the row's `surveyCount`,
 * which is as old as the page.
 */
export const DeleteFieldDialog = ({
  field,
  workspaceId,
  open,
  setOpen,
  onDeleted,
}: Readonly<DeleteFieldDialogProps>) => {
  const { t } = useTranslation();
  const [isDeleting, setIsDeleting] = useState(false);
  const [blockingSurveys, setBlockingSurveys] = useState<TEmbeddedDataUsageItem[] | null>(null);

  const close = () => {
    setBlockingSurveys(null);
    setOpen(false);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await deleteSharedEmbeddedDataAction({ id: field.id });
      if (!response?.data) {
        toast.error(getFormattedErrorMessage(response) || t("common.something_went_wrong_please_try_again"));
        return;
      }

      if (response.data.status === "inUse") {
        setBlockingSurveys(response.data.usage);
        return;
      }

      if (response.data.status === "ok") {
        toast.success(t("workspace.embedded_data.field_deleted", { name: field.name }));
        close();
        onDeleted();
      }
    } finally {
      setIsDeleting(false);
    }
  };

  if (blockingSurveys) {
    return (
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) close();
        }}>
        <DialogContent width="narrow">
          <DialogHeader>
            <DialogTitle>{t("workspace.embedded_data.still_used_title", { name: field.name })}</DialogTitle>
            <DialogDescription>{t("workspace.embedded_data.still_used_description")}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-slate-800">{t("workspace.embedded_data.still_used_body")}</p>
            <ul className="mt-3 flex flex-col gap-2">
              {blockingSurveys.map((survey) => (
                <li key={survey.id} className="flex items-center justify-between gap-3">
                  <Link
                    href={`/workspaces/${workspaceId}/surveys/${survey.id}/edit`}
                    className="truncate text-sm text-slate-800 underline underline-offset-2 hover:text-slate-900">
                    {survey.name}
                  </Link>
                  <span className="shrink-0 text-xs text-slate-500">
                    {getSurveyStatusLabel(survey.status, t)}
                  </span>
                </li>
              ))}
            </ul>
          </DialogBody>
          <DialogFooter>
            <Button type="button" onClick={close}>
              {t("common.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <DeleteDialog
      open={open}
      setOpen={(next) => {
        if (!next) close();
      }}
      deleteWhat={t("workspace.embedded_data.library_field")}
      text={t("workspace.embedded_data.delete_field_text", { name: field.name })}
      onDelete={handleDelete}
      isDeleting={isDeleting}
    />
  );
};
