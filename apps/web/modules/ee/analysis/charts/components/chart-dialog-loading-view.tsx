"use client";

import { Dialog, DialogContent } from "@/modules/ui/components/dialog";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";

interface ChartDialogLoadingViewProps {
  open: boolean;
  onClose: () => void;
}

export function ChartDialogLoadingView({ open, onClose }: ChartDialogLoadingViewProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-[90vw] max-h-[90vh] overflow-y-auto">
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner />
        </div>
      </DialogContent>
    </Dialog>
  );
}
