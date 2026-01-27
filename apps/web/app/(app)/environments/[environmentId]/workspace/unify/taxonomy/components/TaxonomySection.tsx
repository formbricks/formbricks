"use client";

import { useMemo, useState } from "react";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { Input } from "@/modules/ui/components/input";
import { UnifyConfigNavigation } from "../../components/UnifyConfigNavigation";
import { getDetailForL3, getL2Keywords, getL3Keywords, MOCK_LEVEL1_KEYWORDS } from "../lib/mock-data";
import type { TaxonomyKeyword } from "../types";
import { AddKeywordModal } from "./AddKeywordModal";
import { TaxonomyDetailPanel } from "./TaxonomyDetailPanel";
import { TaxonomyKeywordColumn } from "./TaxonomyKeywordColumn";

interface TaxonomySectionProps {
  environmentId: string;
}

export function TaxonomySection({ environmentId }: TaxonomySectionProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedL1Id, setSelectedL1Id] = useState<string | null>("l1-1");
  const [selectedL2Id, setSelectedL2Id] = useState<string | null>("l2-1a");
  const [selectedL3Id, setSelectedL3Id] = useState<string | null>("l3-1a");
  const [addKeywordModalOpen, setAddKeywordModalOpen] = useState(false);
  const [addKeywordModalLevel, setAddKeywordModalLevel] = useState<"L1" | "L2" | "L3">("L1");
  const [customL1Keywords, setCustomL1Keywords] = useState<TaxonomyKeyword[]>([]);
  const [customL2Keywords, setCustomL2Keywords] = useState<TaxonomyKeyword[]>([]);
  const [customL3Keywords, setCustomL3Keywords] = useState<TaxonomyKeyword[]>([]);

  const l2Keywords = useMemo(() => {
    const fromMock = selectedL1Id ? getL2Keywords(selectedL1Id) : [];
    const custom = customL2Keywords.filter((k) => k.parentId === selectedL1Id);
    return [...fromMock, ...custom];
  }, [selectedL1Id, customL2Keywords]);

  const l3Keywords = useMemo(() => {
    const fromMock = selectedL2Id ? getL3Keywords(selectedL2Id) : [];
    const custom = customL3Keywords.filter((k) => k.parentId === selectedL2Id);
    return [...fromMock, ...custom];
  }, [selectedL2Id, customL3Keywords]);
  const detail = useMemo(
    () => (selectedL3Id ? getDetailForL3(selectedL3Id) : null),
    [selectedL3Id]
  );

  const l1Keywords = useMemo(
    () => [...MOCK_LEVEL1_KEYWORDS, ...customL1Keywords],
    [customL1Keywords]
  );

  const filterKeywords = (list: TaxonomyKeyword[], q: string) => {
    if (!q.trim()) return list;
    const lower = q.trim().toLowerCase();
    return list.filter((k) => k.name.toLowerCase().includes(lower));
  };

  const filteredL1 = useMemo(
    () => filterKeywords(l1Keywords, searchQuery),
    [l1Keywords, searchQuery]
  );
  const filteredL2 = useMemo(() => filterKeywords(l2Keywords, searchQuery), [l2Keywords, searchQuery]);
  const filteredL3 = useMemo(() => filterKeywords(l3Keywords, searchQuery), [l3Keywords, searchQuery]);

  const selectedL1Name = useMemo(
    () => l1Keywords.find((k) => k.id === selectedL1Id)?.name,
    [l1Keywords, selectedL1Id]
  );
  const selectedL2Name = useMemo(
    () => l2Keywords.find((k) => k.id === selectedL2Id)?.name,
    [l2Keywords, selectedL2Id]
  );

  const addKeywordParentName =
    addKeywordModalLevel === "L2" ? selectedL1Name : addKeywordModalLevel === "L3" ? selectedL2Name : undefined;

  const handleAddKeyword = (name: string) => {
    if (addKeywordModalLevel === "L1") {
      const id = `custom-l1-${crypto.randomUUID()}`;
      setCustomL1Keywords((prev) => [...prev, { id, name, count: 0 }]);
      setSelectedL1Id(id);
      setSelectedL2Id(null);
      setSelectedL3Id(null);
    } else if (addKeywordModalLevel === "L2" && selectedL1Id) {
      const id = `custom-l2-${crypto.randomUUID()}`;
      setCustomL2Keywords((prev) => [
        ...prev,
        { id, name, count: 0, parentId: selectedL1Id },
      ]);
      setSelectedL2Id(id);
      setSelectedL3Id(null);
    } else if (addKeywordModalLevel === "L3" && selectedL2Id) {
      const id = `custom-l3-${crypto.randomUUID()}`;
      setCustomL3Keywords((prev) => [
        ...prev,
        { id, name, count: 0, parentId: selectedL2Id },
      ]);
      setSelectedL3Id(id);
    }
  };

  return (
    <PageContentWrapper>
      <PageHeader pageTitle="Unify Feedback">
        <UnifyConfigNavigation environmentId={environmentId} />
      </PageHeader>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Input
            placeholder="Find in taxonomy..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <TaxonomyKeywordColumn
              title={`Level 1 Keywords (${filteredL1.length})`}
              keywords={filteredL1}
              selectedId={selectedL1Id}
              onSelect={(id) => {
                setSelectedL1Id(id);
                setSelectedL2Id(null);
                setSelectedL3Id(null);
              }}
              addButtonLabel="Add L1 Keyword"
              onAdd={() => {
                setAddKeywordModalLevel("L1");
                setAddKeywordModalOpen(true);
              }}
            />
          </div>
          <div className="lg:col-span-3">
            <TaxonomyKeywordColumn
              title={`Level 2 Keywords (${filteredL2.length})`}
              keywords={filteredL2}
              selectedId={selectedL2Id}
              onSelect={(id) => {
                setSelectedL2Id(id);
                setSelectedL3Id(null);
              }}
              addButtonLabel="Add L2 Keyword"
              onAdd={() => {
                setAddKeywordModalLevel("L2");
                setAddKeywordModalOpen(true);
              }}
            />
          </div>
          <div className="lg:col-span-3">
            <TaxonomyKeywordColumn
              title={`Level 3 Keywords (${filteredL3.length})`}
              keywords={filteredL3}
              selectedId={selectedL3Id}
              onSelect={setSelectedL3Id}
              addButtonLabel="Add L3 Keyword"
              onAdd={() => {
                setAddKeywordModalLevel("L3");
                setAddKeywordModalOpen(true);
              }}
            />
          </div>
          <div className="min-h-[400px] lg:col-span-3">
            <TaxonomyDetailPanel detail={detail} />
          </div>
        </div>
      </div>

      <AddKeywordModal
        open={addKeywordModalOpen}
        onOpenChange={setAddKeywordModalOpen}
        level={addKeywordModalLevel}
        parentName={addKeywordParentName}
        onConfirm={handleAddKeyword}
      />
    </PageContentWrapper>
  );
}
