"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { type TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { getSharedEmbeddedDataAction } from "@/modules/embedded-data/actions";
import {
  getDataTypeLabel,
  getSourceIcon,
  getSourceLabel,
} from "@/modules/embedded-data/settings/components/field-labels";
import type { TSharedEmbeddedDataListItem } from "@/modules/embedded-data/types";
import {
  type TLinkableSharedField,
  listLinkableSharedFields,
} from "@/modules/survey/editor/lib/embedded-fields";
import { Badge } from "@/modules/ui/components/badge";
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
import { EmptyState } from "@/modules/ui/components/empty-state";
import { IdBadge } from "@/modules/ui/components/id-badge";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";

interface EmbeddedDataLibraryDialogProps {
  workspaceId: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  /** The survey's fields as the editor holds them — what a row is offered against. */
  embeddedFields: readonly TLinkedEmbeddedField[];
  /** The survey's fields as stored — the baseline the clash guard grandfathers names against. */
  persistedFields: readonly TLinkedEmbeddedField[];
  onLink: (field: TLinkableSharedField) => void;
}

/**
 * "Add from library": the workspace's shared fields, minus the ones this survey cannot take.
 *
 * Read through the same server action the workspace manager page uses, on open rather than on mount,
 * so a survey whose author never opens this never pays for the query — and so the list is current
 * rather than whatever it was when the editor loaded.
 *
 * **Which rows are offered is `listLinkableSharedFields`' answer, not this component's.** A row is
 * left out when the survey already links it, when its address is taken, or when adding it would put
 * one name in both the calculated and passed-in namespaces — the last of those decided by the same
 * guard, with the same grandfathering, that the save would apply.
 */
export const EmbeddedDataLibraryDialog = ({
  workspaceId,
  open,
  setOpen,
  embeddedFields,
  persistedFields,
  onLink,
}: Readonly<EmbeddedDataLibraryDialogProps>) => {
  const { t } = useTranslation();
  const [library, setLibrary] = useState<TSharedEmbeddedDataListItem[] | null>(null);

  useEffect(() => {
    if (!open) return;

    let isCurrent = true;
    const load = async () => {
      const response = await getSharedEmbeddedDataAction({ workspaceId });
      if (!isCurrent) return;

      if (!response?.data) {
        toast.error(getFormattedErrorMessage(response) || t("common.something_went_wrong_please_try_again"));
        setLibrary([]);
        return;
      }

      setLibrary(response.data);
    };

    void load();
    return () => {
      isCurrent = false;
    };
  }, [open, workspaceId, t]);

  const linkable =
    library === null ? [] : listLinkableSharedFields({ library, embeddedFields, persistedFields });

  const renderBody = () => {
    if (library === null) {
      return (
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      );
    }

    if (linkable.length === 0) {
      return (
        <EmptyState
          variant="simple"
          text={
            library.length === 0
              ? t("workspace.embedded_data.empty_state")
              : t("workspace.embedded_data.library_all_added")
          }
        />
      );
    }

    return (
      <div className="flex flex-col gap-2">
        {linkable.map((field) => (
          <div
            key={field.id}
            className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3"
            data-testid="embedded-data-library-row">
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-medium text-slate-800">{field.name}</span>
                <IdBadge id={field.key} showCopyIconOnHover={true} />
              </div>
              {field.description && <p className="text-xs text-slate-500">{field.description}</p>}
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  {getSourceIcon(field.source, "size-3.5")}
                  {getSourceLabel(field.source, t)}
                </span>
                <Badge text={getDataTypeLabel(field.dataType, t)} type="gray" size="tiny" />
              </div>
            </div>
            <Button size="sm" type="button" onClick={() => onLink(field)}>
              {t("common.add")}
            </Button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setOpen(false);
      }}>
      <DialogContent width="default">
        <DialogHeader>
          <DialogTitle>{t("workspace.embedded_data.add_from_library")}</DialogTitle>
          <DialogDescription>{t("workspace.embedded_data.add_from_library_description")}</DialogDescription>
        </DialogHeader>

        <DialogBody>{renderBody()}</DialogBody>

        <DialogFooter className="mt-4">
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            {t("common.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
