"use client";

import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/modules/ui/components/dialog";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";

interface SaveChartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chartName: string;
  onChartNameChange: (name: string) => void;
  onSave: () => void;
  isSaving: boolean;
}

export function SaveChartDialog({
  open,
  onOpenChange,
  chartName,
  onChartNameChange,
  onSave,
  isSaving,
}: SaveChartDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save Chart</DialogTitle>
          <DialogDescription>Enter a name for your chart to save it.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Input
            placeholder="Chart name"
            value={chartName}
            onChange={(e) => onChartNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && chartName.trim() && !isSaving) {
                onSave();
              }
            }}
          />
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={onSave} loading={isSaving} disabled={!chartName.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
