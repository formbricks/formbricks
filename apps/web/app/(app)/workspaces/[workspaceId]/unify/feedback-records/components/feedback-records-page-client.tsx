"use client";

import { useTranslation } from "react-i18next";
import type { FeedbackRecordData } from "@/modules/hub/types";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { UnifyConfigNavigation } from "../../components/UnifyConfigNavigation";
import { FeedbackRecordsTable } from "./feedback-records-table";

interface FeedbackRecordsPageClientProps {
  workspaceId: string;
  initialRecords: FeedbackRecordData[];
  csvSources: { id: string; name: string }[];
  canWrite: boolean;
}

export function FeedbackRecordsPageClient({
  workspaceId,
  initialRecords,
  csvSources,
  canWrite,
}: Readonly<FeedbackRecordsPageClientProps>) {
  const { t } = useTranslation();

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("workspace.unify.feedback_records")}>
        <UnifyConfigNavigation workspaceId={workspaceId} activeId="feedback-records" />
      </PageHeader>

      <FeedbackRecordsTable
        workspaceId={workspaceId}
        initialRecords={initialRecords}
        csvSources={csvSources}
        canWrite={canWrite}
      />
    </PageContentWrapper>
  );
}
