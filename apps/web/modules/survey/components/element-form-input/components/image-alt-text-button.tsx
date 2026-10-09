"use client";

import { CheckIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
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

interface ImageAltTextButtonProps {
  label: string;
  hasAltText: boolean;
  isInvalid: boolean;
  // The alt text input. It is only mounted while the dialog is open, and the image cannot be swapped or
  // removed behind the open dialog, so an edit always lands on the image the dialog was opened for.
  children: ReactNode;
}

export const ImageAltTextButton = ({
  label,
  hasAltText,
  isInvalid,
  children,
}: Readonly<ImageAltTextButtonProps>) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={label}
        className={cn(
          "absolute bottom-2 left-2 flex cursor-pointer items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700 opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100",
          isInvalid && "bg-red-100 text-red-700 opacity-100"
        )}
        onClick={(e) => {
          e.preventDefault();
          setOpen(true);
        }}>
        {t("workspace.surveys.edit.image_alt_text_button")}
        {hasAltText && <CheckIcon className="size-3" />}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("workspace.surveys.edit.image_alt_text_dialog_title")}</DialogTitle>
            <DialogDescription>{t("workspace.surveys.edit.image_alt_text_help")}</DialogDescription>
          </DialogHeader>
          <DialogBody unconstrained>{children}</DialogBody>
          <DialogFooter>
            <Button type="button" onClick={() => setOpen(false)}>
              {t("common.done")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
