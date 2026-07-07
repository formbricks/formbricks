"use client";

import { TopicsSubtopicsContainer } from "../components/topics-subtopics-container";
import { TopicsSubtopicsQueryClientProvider } from "../query-client-provider";

interface TopicsSubtopicsPageProps {
  workspaceId: string;
  directoryMap: Record<string, string>;
  canWrite: boolean;
}

export const TopicsSubtopicsPage = ({
  workspaceId,
  directoryMap,
  canWrite,
}: Readonly<TopicsSubtopicsPageProps>) => (
  <TopicsSubtopicsQueryClientProvider>
    <TopicsSubtopicsContainer workspaceId={workspaceId} directoryMap={directoryMap} canWrite={canWrite} />
  </TopicsSubtopicsQueryClientProvider>
);
