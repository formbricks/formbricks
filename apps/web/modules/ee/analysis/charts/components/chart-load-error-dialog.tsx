"use client";

import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";

interface ChartLoadErrorDialogProps {
  open: boolean;
  message: string;
  onClose: () => void;
}

/** A saved chart that could not be loaded: there is nothing to configure, so say so and stop. */
export function ChartLoadErrorDialog({ open, message, onClose }: Readonly<ChartLoadErrorDialogProps>) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent width="full">
        <DialogHeader>
          <DialogTitle>{t("common.error")}</DialogTitle>
          <DialogDescription />
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col items-center justify-center gap-4 py-8">
            <p className="text-sm text-red-600">{message}</p>
            <Button variant="outline" onClick={onClose}>
              {t("common.close")}
            </Button>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
