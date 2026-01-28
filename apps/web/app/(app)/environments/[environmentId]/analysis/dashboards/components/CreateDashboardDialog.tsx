"use client";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";

interface CreateDashboardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dashboardName: string;
  onDashboardNameChange: (name: string) => void;
  dashboardDescription: string;
  onDashboardDescriptionChange: (description: string) => void;
  onCreate: () => void;
  isCreating: boolean;
}

export function CreateDashboardDialog({
  open,
  onOpenChange,
  dashboardName,
  onDashboardNameChange,
  dashboardDescription,
  onDashboardDescriptionChange,
  onCreate,
  isCreating,
}: CreateDashboardDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Dashboard</DialogTitle>
          <DialogDescription>Enter a name for your dashboard to create it.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="dashboard-name" className="text-sm font-medium text-gray-900">
              Dashboard Name
            </label>
            <Input
              id="dashboard-name"
              placeholder="Dashboard name"
              value={dashboardName}
              onChange={(e) => onDashboardNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && dashboardName.trim() && !isCreating) {
                  onCreate();
                }
              }}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="dashboard-description" className="text-sm font-medium text-gray-900">
              Description (Optional)
            </label>
            <Input
              id="dashboard-description"
              placeholder="Dashboard description"
              value={dashboardDescription}
              onChange={(e) => onDashboardDescriptionChange(e.target.value)}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={onCreate} loading={isCreating} disabled={!dashboardName.trim()}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
