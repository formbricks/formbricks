"use client";

import { useState } from "react";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { UnifyConfigNavigation } from "../../components/UnifyConfigNavigation";
import { CreateSourceModal } from "./create-source-modal";
import { EditSourceModal } from "./edit-source-modal";
import { SourcesTable } from "./sources-table";
import { TSourceConnection } from "./types";

interface SourcesSectionProps {
  environmentId: string;
}

export function SourcesSection({ environmentId }: SourcesSectionProps) {
  const [sources, setSources] = useState<TSourceConnection[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<TSourceConnection | null>(null);

  const handleCreateSource = (source: TSourceConnection) => {
    setSources((prev) => [...prev, source]);
  };

  const handleUpdateSource = (updatedSource: TSourceConnection) => {
    setSources((prev) => prev.map((s) => (s.id === updatedSource.id ? updatedSource : s)));
  };

  const handleDeleteSource = (sourceId: string) => {
    setSources((prev) => prev.filter((s) => s.id !== sourceId));
  };

  const handleSourceClick = (source: TSourceConnection) => {
    setEditingSource(source);
  };

  return (
    <PageContentWrapper>
      <PageHeader
        pageTitle="Unify Feedback"
        cta={
          <CreateSourceModal
            open={isCreateModalOpen}
            onOpenChange={setIsCreateModalOpen}
            onCreateSource={handleCreateSource}
          />
        }>
        <UnifyConfigNavigation environmentId={environmentId} />
      </PageHeader>

      <div className="space-y-6">
        <SourcesTable sources={sources} onSourceClick={handleSourceClick} />
      </div>

      <EditSourceModal
        source={editingSource}
        open={editingSource !== null}
        onOpenChange={(open) => !open && setEditingSource(null)}
        onUpdateSource={handleUpdateSource}
        onDeleteSource={handleDeleteSource}
      />
    </PageContentWrapper>
  );
}
