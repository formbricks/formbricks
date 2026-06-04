"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@formbricks/ui/components/Button";
import { Label } from "@formbricks/ui/components/Label";
import { Input } from "@formbricks/ui/components/input";
import { createStyleGuideAction } from "../actions";

interface CreateStyleGuideModalProps {
  organizationId: string;
  workspaceId: string;
  onClose: () => void;
}

export function CreateStyleGuideModal({ organizationId, workspaceId, onClose }: CreateStyleGuideModalProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [brandColor, setBrandColor] = useState("#000000");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await createStyleGuideAction(organizationId, {
        name: name.trim(),
        brandColor,
        organizationId,
      });
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create style guide");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-slate-900">Create New Style Guide</h2>
        <form onSubmit={handleCreate} className="mt-4 space-y-4">
          <div>
            <Label htmlFor="name">Style Guide Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Brand Kit 2024"
              disabled={isLoading}
            />
          </div>

          <div>
            <Label htmlFor="brandColor">Brand Color</Label>
            <div className="flex gap-2">
              <input
                id="brandColor"
                type="color"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                disabled={isLoading}
                className="h-10 w-20 rounded border border-slate-300"
              />
              <Input
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                placeholder="#000000"
                disabled={isLoading}
                className="flex-1"
              />
            </div>
          </div>

          {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
