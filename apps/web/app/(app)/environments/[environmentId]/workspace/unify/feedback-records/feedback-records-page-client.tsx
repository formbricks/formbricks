"use client";

import { useTranslation } from "react-i18next";
import type { FeedbackRecordData } from "@/modules/hub/types";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { UnifyConfigNavigation } from "../components/UnifyConfigNavigation";
import { FeedbackRecordsTable } from "./feedback-records-table";

interface FeedbackRecordsPageClientProps {
  environmentId: string;
  initialRecords: FeedbackRecordData[];
  initialTotal: number;
}

export function FeedbackRecordsPageClient({
  environmentId,
  initialRecords,
  initialTotal,
}: FeedbackRecordsPageClientProps) {
  const { t } = useTranslation();

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("environments.unify.unify_feedback")}>
        <UnifyConfigNavigation environmentId={environmentId} activeId="feedback-records" />
      </PageHeader>

      <FeedbackRecordsTable
        environmentId={environmentId}
        initialRecords={initialRecords}
        initialTotal={initialTotal}
      />
    </PageContentWrapper>
  );
}
