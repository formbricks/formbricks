"use client";

import { useState } from "react";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { UnifyConfigNavigation } from "../../components/UnifyConfigNavigation";
import type { KnowledgeItem } from "../types";
import { AddKnowledgeModal } from "./AddKnowledgeModal";
import { KnowledgeTable } from "./KnowledgeTable";

interface KnowledgeSectionProps {
  environmentId: string;
  isStorageConfigured: boolean;
}

export function KnowledgeSection({ environmentId, isStorageConfigured }: KnowledgeSectionProps) {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  const handleDeleteItem = (itemId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  return (
    <PageContentWrapper>
      <PageHeader
        pageTitle="Unify Feedback"
        cta={
          <AddKnowledgeModal
            open={modalOpen}
            onOpenChange={setModalOpen}
            onAdd={(item) => {
              setItems((prev) => [...prev, item]);
              setModalOpen(false);
            }}
            environmentId={environmentId}
            isStorageConfigured={isStorageConfigured}
          />
        }>
        <UnifyConfigNavigation environmentId={environmentId} />
      </PageHeader>
      <div className="space-y-6">
        <KnowledgeTable items={items} onDeleteItem={handleDeleteItem} />
      </div>
    </PageContentWrapper>
  );
}
