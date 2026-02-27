"use client";

import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogTitle } from "@/modules/ui/components/dialog";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";

interface ChartDialogLoadingViewProps {
  open: boolean;
  onClose: () => void;
}

export function ChartDialogLoadingView({ open, onClose }: Readonly<ChartDialogLoadingViewProps>) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent width="wide">
        <DialogTitle className="sr-only">{t("common.loading")}</DialogTitle>
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner />
        </div>
      </DialogContent>
    </Dialog>
  );
}
