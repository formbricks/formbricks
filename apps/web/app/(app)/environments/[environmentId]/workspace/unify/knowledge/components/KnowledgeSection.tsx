"use client";

import { useState } from "react";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import type { KnowledgeItem } from "../types";
import { AddKnowledgeModal } from "./AddKnowledgeModal";
import { KnowledgeTable } from "./KnowledgeTable";
import { UnifyConfigNavigation } from "../../components/UnifyConfigNavigation";

interface KnowledgeSectionProps {
  environmentId: string;
  isStorageConfigured: boolean;
}

export function KnowledgeSection({ environmentId, isStorageConfigured }: KnowledgeSectionProps) {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

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
        <KnowledgeTable items={items} />
      </div>
    </PageContentWrapper>
  );
}
