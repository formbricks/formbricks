"use client";

import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { StyleGuide } from "@formbricks/types/style-guide";
import { Button } from "@formbricks/ui/components/Button";
import { CreateStyleGuideModal } from "./CreateStyleGuideModal";
import { StyleGuideCard } from "./StyleGuideCard";

interface StyleGuidesContentProps {
  workspaceId: string;
  organizationId: string;
  styleGuides: StyleGuide[];
  isOwner: boolean;
  activeStyleGuideId: string | null;
}

export function StyleGuidesContent({
  workspaceId,
  organizationId,
  styleGuides,
  isOwner,
  activeStyleGuideId,
}: StyleGuidesContentProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <div className="space-y-4">
      {isOwner && (
        <Button onClick={() => setShowCreateModal(true)} className="gap-2">
          <PlusIcon className="h-4 w-4" />
          Create new Style Guide
        </Button>
      )}

      {styleGuides.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center">
          <p className="text-slate-600">
            No style guides created yet. {isOwner && "Create one to get started!"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {styleGuides.map((styleGuide) => (
            <StyleGuideCard
              key={styleGuide.id}
              styleGuide={styleGuide}
              workspaceId={workspaceId}
              isActive={styleGuide.id === activeStyleGuideId}
              isOwner={isOwner}
            />
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateStyleGuideModal
          organizationId={organizationId}
          workspaceId={workspaceId}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}
