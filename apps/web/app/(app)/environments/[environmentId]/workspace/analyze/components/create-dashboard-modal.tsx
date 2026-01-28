"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { TDashboard } from "./types";

interface CreateDashboardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateDashboard: (dashboard: TDashboard) => void;
}

export function CreateDashboardModal({ open, onOpenChange, onCreateDashboard }: CreateDashboardModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleCreate = () => {
    if (!name.trim()) return;

    const newDashboard: TDashboard = {
      id: crypto.randomUUID(),
      name: name.trim(),
      description: description.trim() || undefined,
      widgetCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    onCreateDashboard(newDashboard);
    resetForm();
    onOpenChange(false);
  };

  const resetForm = () => {
    setName("");
    setDescription("");
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  return (
    <>
      <Button onClick={() => onOpenChange(true)} size="sm">
        Create dashboard
        <PlusIcon className="ml-2 h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Dashboard</DialogTitle>
            <DialogDescription>
              Create a new dashboard to visualize and analyze your unified feedback data.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="dashboardName">Name</Label>
              <Input
                id="dashboardName"
                placeholder="e.g., Product Feedback Overview"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dashboardDescription">Description (optional)</Label>
              <Input
                id="dashboardDescription"
                placeholder="e.g., Weekly overview of customer feedback trends"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!name.trim()}>
              Create dashboard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
