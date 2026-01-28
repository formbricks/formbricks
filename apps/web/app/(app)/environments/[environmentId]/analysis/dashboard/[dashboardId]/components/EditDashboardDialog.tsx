"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
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
import { updateDashboardAction } from "../../../actions";

interface EditDashboardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dashboardId: string;
  environmentId: string;
  initialName: string;
  initialDescription?: string;
  onSuccess: () => void;
}

export function EditDashboardDialog({
  open,
  onOpenChange,
  dashboardId,
  environmentId,
  initialName,
  initialDescription,
  onSuccess,
}: EditDashboardDialogProps) {
  const [dashboardName, setDashboardName] = useState(initialName);
  const [dashboardDescription, setDashboardDescription] = useState(initialDescription || "");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDashboardName(initialName);
      setDashboardDescription(initialDescription || "");
    }
  }, [open, initialName, initialDescription]);

  const handleSave = async () => {
    if (!dashboardName.trim()) {
      toast.error("Please enter a dashboard name");
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateDashboardAction({
        environmentId,
        dashboardId,
        name: dashboardName.trim(),
        description: dashboardDescription.trim() || null,
      });

      if (!result?.data) {
        toast.error(result?.serverError || "Failed to update dashboard");
        return;
      }

      toast.success("Dashboard updated successfully!");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to update dashboard");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Dashboard</DialogTitle>
          <DialogDescription>Update dashboard name and description.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="edit-dashboard-name" className="text-sm font-medium text-gray-900">
              Dashboard Name
            </label>
            <Input
              id="edit-dashboard-name"
              placeholder="Dashboard name"
              value={dashboardName}
              onChange={(e) => setDashboardName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && dashboardName.trim() && !isSaving) {
                  handleSave();
                }
              }}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="edit-dashboard-description" className="text-sm font-medium text-gray-900">
              Description (Optional)
            </label>
            <Input
              id="edit-dashboard-description"
              placeholder="Dashboard description"
              value={dashboardDescription}
              onChange={(e) => setDashboardDescription(e.target.value)}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={isSaving} disabled={!dashboardName.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
