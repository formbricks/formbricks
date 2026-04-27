"use client";

import { useTranslation } from "react-i18next";
import type { FeedbackRecordData } from "@/modules/hub/types";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { UnifyConfigNavigation } from "../components/UnifyConfigNavigation";
import { FeedbackRecordsTable } from "./feedback-records-table";

interface FeedbackRecordsPageClientProps {
  workspaceId: string;
  directories: { id: string; name: string }[];
  initialFrdId: string | null;
  initialRecords: FeedbackRecordData[];
  initialNextCursor?: string;
}

export function FeedbackRecordsPageClient({
  workspaceId,
  directories,
  initialFrdId,
  initialRecords,
  initialNextCursor,
}: FeedbackRecordsPageClientProps) {
  const { t } = useTranslation();

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("workspace.unify.unify_feedback")}>
        <UnifyConfigNavigation workspaceId={workspaceId} activeId="feedback-records" />
      </PageHeader>

      <FeedbackRecordsTable
        workspaceId={workspaceId}
        directories={directories}
        initialFrdId={initialFrdId}
        initialRecords={initialRecords}
        initialNextCursor={initialNextCursor}
      />
    </PageContentWrapper>
  );
}
