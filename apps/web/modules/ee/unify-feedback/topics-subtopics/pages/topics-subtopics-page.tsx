"use client";

import { TopicsSubtopicsContainer } from "../components/topics-subtopics-container";

interface TopicsSubtopicsPageProps {
  workspaceId: string;
  directoryMap: Record<string, string>;
  canWrite: boolean;
}

/** Reads through the workspace layout's `ApiQueryClientProvider`, so the house retry rule applies. */
export const TopicsSubtopicsPage = ({
  workspaceId,
  directoryMap,
  canWrite,
}: Readonly<TopicsSubtopicsPageProps>) => (
  <TopicsSubtopicsContainer workspaceId={workspaceId} directoryMap={directoryMap} canWrite={canWrite} />
);
