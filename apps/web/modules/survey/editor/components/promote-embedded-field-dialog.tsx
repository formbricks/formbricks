"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { type TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";
import { toSafeIdentifier } from "@formbricks/types/safe-identifier";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { promoteEmbeddedDataToSharedAction } from "@/modules/embedded-data/actions";
import type { TSharedEmbeddedData } from "@/modules/embedded-data/types";
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
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";

interface PromoteEmbeddedFieldDialogProps {
  /** The local field being lifted. Its `field.id` is the stored row promote flips. */
  entry: TLinkedEmbeddedField;
  open: boolean;
  setOpen: (open: boolean) => void;
  onPromoted: (field: TSharedEmbeddedData) => void;
}

/**
 * "Add to library": the survey's own field becomes a workspace one, keeping its link.
 *
 * Promote is an **ownership change on the stored row**, not a copy — the row keeps its id, the
 * survey keeps its link and its responses keep their address, and all that changes is that
 * `surveyId` gives way to a library `key`. So the only thing to collect is that key and an optional
 * description; everything else about the field is already right.
 *
 * The write's refusals arrive **inside a successful payload** rather than as thrown errors: the
 * action client flattens a throw to `error.message`, which would lose the id of the row already
 * holding the key. Each branch is answered where the author can act on it — a taken key on the
 * control that carries it, anything else as a toast.
 */
export const PromoteEmbeddedFieldDialog = ({
  entry,
  open,
  setOpen,
  onPromoted,
}: Readonly<PromoteEmbeddedFieldDialogProps>) => {
  const { t } = useTranslation();
  // The key writes itself from the field's name, through the same `toSafeIdentifier` the library
  // dialog uses to decide what a legal key looks like.
  const [key, setKey] = useState(() => toSafeIdentifier(entry.field.name));
  const [description, setDescription] = useState("");
  const [keyError, setKeyError] = useState<string | null>(null);
  const [isPromoting, setIsPromoting] = useState(false);

  const handlePromote = async () => {
    // `field.id` is what promote addresses; a field the survey has never saved has no row to lift,
    // which the card refuses before opening this dialog.
    if (entry.field.id === undefined) return;

    setKeyError(null);
    setIsPromoting(true);

    try {
      const response = await promoteEmbeddedDataToSharedAction({
        id: entry.field.id,
        key,
        description: description.trim() === "" ? null : description,
      });

      if (!response?.data) {
        toast.error(getFormattedErrorMessage(response) || t("common.something_went_wrong_please_try_again"));
        return;
      }

      if (response.data.status === "keyConflict") {
        setKeyError(t("workspace.embedded_data.key_already_exists"));
        return;
      }

      // Promote never refuses on usage — it changes no `dataType` and deletes nothing — but the
      // result is a union, and a branch that cannot happen must still not fail silently.
      if (response.data.status === "inUse") {
        toast.error(response.data.message);
        return;
      }

      toast.success(t("workspace.embedded_data.field_in_library", { name: response.data.field.name }));
      onPromoted(response.data.field);
      setOpen(false);
    } finally {
      setIsPromoting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setOpen(false);
      }}>
      <DialogContent width="narrow">
        <DialogHeader>
          <DialogTitle>{t("workspace.embedded_data.add_to_library")}</DialogTitle>
          <DialogDescription>
            {t("workspace.embedded_data.add_to_library_description", { name: entry.field.name })}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="promote-embedded-field-key">{t("common.key")}</Label>
              <Input
                id="promote-embedded-field-key"
                autoFocus
                value={key}
                isInvalid={keyError !== null}
                // `isInvalid` only draws a red border. Without these the refusal is visible and
                // nothing else: focus stays on the button and a screen reader is told nothing.
                aria-invalid={keyError !== null}
                aria-describedby={keyError === null ? undefined : "promote-embedded-field-key-error"}
                onKeyDown={(event) => {
                  // Every other dialog in this card submits on Enter; this one had no <form>.
                  if (event.key === "Enter" && !isPromoting) void handlePromote();
                }}
                onChange={(event) => {
                  setKey(event.target.value);
                  setKeyError(null);
                }}
              />
              <p className="text-xs text-slate-500">{t("workspace.embedded_data.key_hint")}</p>
              {keyError && (
                <p id="promote-embedded-field-key-error" className="text-sm text-red-500">
                  {keyError}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="promote-embedded-field-description">
                {`${t("common.description")} (${t("common.optional")})`}
              </Label>
              <Input
                id="promote-embedded-field-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
          </div>
        </DialogBody>

        <DialogFooter className="mt-4">
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button type="button" loading={isPromoting} onClick={handlePromote}>
            {t("workspace.embedded_data.add_to_library")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
