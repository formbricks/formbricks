"use client";

import { useState } from "react";
import toast from "react-hot-toast";
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

export type AddKeywordModalLevel = "L1" | "L2" | "L3";

interface AddKeywordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  level: AddKeywordModalLevel;
  parentName?: string;
  onConfirm: (name: string) => void;
}

export function AddKeywordModal({
  open,
  onOpenChange,
  level,
  parentName,
  onConfirm,
}: AddKeywordModalProps) {
  const [name, setName] = useState("");

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) setName("");
    onOpenChange(nextOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Please enter a keyword name.");
      return;
    }
    onConfirm(trimmed);
    setName("");
    onOpenChange(false);
    toast.success("Keyword added (demo).");
  };

  const title =
    level === "L1" ? "Add L1 keyword" : level === "L2" ? "Add L2 keyword" : "Add L3 keyword";
  const description =
    level === "L1"
      ? "Add a new top-level keyword."
      : parentName
        ? `Add a new ${level} keyword under "${parentName}".`
        : `Add a new ${level} keyword.`;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody>
            <div className="space-y-2">
              <Label htmlFor="keyword-name">Keyword name</Label>
              <Input
                id="keyword-name"
                placeholder="e.g. New category"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full"
              />
            </div>
          </DialogBody>
          <DialogFooter className="m-2">
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
            <Button type="submit">Add keyword</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
