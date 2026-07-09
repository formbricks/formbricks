"use client";

import { useTranslation } from "react-i18next";
import type { TFeedbackSourceFieldMapping } from "@formbricks/types/feedback-source";
import type { FeedbackRecordData } from "@/modules/hub/types";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { FeedbackRecordsTable } from "./feedback-records-table";
import { UnifyConfigNavigation } from "./unify-config-navigation";

interface FeedbackRecordsPageClientProps {
  workspaceId: string;
  initialRecords: FeedbackRecordData[];
  initialCursors: Record<string, string>;
  initialContactIdByUserId: Record<string, string>;
  frdMap: Record<string, string>;
  csvSources: { id: string; name: string; fieldMappings: TFeedbackSourceFieldMapping[] }[];
  canWrite: boolean;
}

export function FeedbackRecordsPageClient({
  workspaceId,
  initialRecords,
  initialCursors,
  initialContactIdByUserId,
  frdMap,
  csvSources,
  canWrite,
}: Readonly<FeedbackRecordsPageClientProps>) {
  const { t } = useTranslation();

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("workspace.unify.feedback_data")}>
        <UnifyConfigNavigation workspaceId={workspaceId} activeId="feedback-records" />
      </PageHeader>

      <FeedbackRecordsTable
        workspaceId={workspaceId}
        initialRecords={initialRecords}
        initialCursors={initialCursors}
        initialContactIdByUserId={initialContactIdByUserId}
        frdMap={frdMap}
        csvSources={csvSources}
        canWrite={canWrite}
      />
    </PageContentWrapper>
  );
}
