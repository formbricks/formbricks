"use client";

import { ChevronRightIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { StyleGuide } from "@formbricks/types/style-guide";
import { Button } from "@formbricks/ui/components/Button";
import { deleteStyleGuideAction, setActiveStyleGuideForWorkspaceAction } from "../actions";

interface StyleGuideCardProps {
  styleGuide: StyleGuide;
  workspaceId: string;
  isActive: boolean;
  isOwner: boolean;
}

export function StyleGuideCard({ styleGuide, workspaceId, isActive, isOwner }: StyleGuideCardProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSettingActive, setIsSettingActive] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Are you sure? Surveys using this style guide will not be deleted.")) return;

    setIsDeleting(true);
    try {
      await deleteStyleGuideAction(styleGuide.id);
      router.refresh();
    } catch (error) {
      console.error(error);
      alert("Failed to delete style guide");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleActivate = async () => {
    setIsSettingActive(true);
    try {
      await setActiveStyleGuideForWorkspaceAction(workspaceId, styleGuide.id);
      router.refresh();
    } catch (error) {
      console.error(error);
      alert("Failed to activate style guide");
    } finally {
      setIsSettingActive(false);
    }
  };

  return (
    <div
      className={`rounded-lg border p-4 ${isActive ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white"}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-900">{styleGuide.name}</h3>
            {isActive && (
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                Active
              </span>
            )}
          </div>
          {styleGuide.version && <p className="text-sm text-slate-600">Version {styleGuide.version}</p>}
          {styleGuide.authors && <p className="text-sm text-slate-600">By {styleGuide.authors}</p>}
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Link
          href={`/workspaces/${workspaceId}/settings/organization/style-guides/${styleGuide.id}`}
          className="flex-1">
          <Button variant="secondary" className="w-full" disabled={isDeleting || isSettingActive}>
            Edit
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
        </Link>

        {!isActive && (
          <Button variant="secondary" onClick={handleActivate} disabled={isSettingActive || isDeleting}>
            Activate
          </Button>
        )}

        {isOwner && (
          <Button variant="ghost" size="sm" onClick={handleDelete} disabled={isDeleting || isSettingActive}>
            <Trash2Icon className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
