"use client";

import Link from "next/link";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { organizationSettingsPath } from "@/modules/settings/lib/routes";
import { Button } from "@/modules/ui/components/button";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getFeedbackDatasetViewAction } from "../actions";
import type { TFeedbackDatasetView } from "../lib/dataset-view";
import { DatasetOverviewHeader } from "./dataset-overview-header";
import { DatasetSelector } from "./dataset-selector";
import { FeedbackRecordsTable } from "./feedback-records-table";
import { UnifyFeedbackNavigation } from "./unify-feedback-navigation";

interface FeedbackRecordsPageClientProps {
  organizationId: string;
  datasets: { id: string; name: string }[];
  initialDatasetId: string;
  initialView: TFeedbackDatasetView;
  // Managing datasets (create/assign/archive) stays owner/manager; surfaces a link to the management
  // page so it remains reachable now that the nav entry points at this records view.
  isOwnerOrManager: boolean;
}

export function FeedbackRecordsPageClient({
  organizationId,
  datasets,
  initialDatasetId,
  initialView,
  isOwnerOrManager,
}: Readonly<FeedbackRecordsPageClientProps>) {
  const { t, i18n } = useTranslation();
  const resolvedLocale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  const [selectedDatasetId, setSelectedDatasetId] = useState(initialDatasetId);
  const [view, setView] = useState<TFeedbackDatasetView>(initialView);
  const [isSwitching, setIsSwitching] = useState(false);

  const selectedDataset = datasets.find((dataset) => dataset.id === selectedDatasetId);
  const selectedDatasetName = selectedDataset?.name ?? "";

  const handleDatasetChange = async (nextDatasetId: string) => {
    if (nextDatasetId === selectedDatasetId || isSwitching) return;
    setIsSwitching(true);
    const result = await getFeedbackDatasetViewAction({ organizationId, directoryId: nextDatasetId });
    if (!result?.data) {
      toast.error(getFormattedErrorMessage(result) || t("workspace.unify.failed_to_load_feedback_records"));
      setIsSwitching(false);
      return;
    }
    setSelectedDatasetId(nextDatasetId);
    setView(result.data);
    setIsSwitching(false);
  };

  return (
    <PageContentWrapper>
      <PageHeader
        pageTitle={t("workspace.unify.feedback_records")}
        cta={
          isOwnerOrManager ? (
            <Button variant="secondary" size="sm" asChild>
              <Link href={organizationSettingsPath(organizationId, "feedback-directories")}>
                {t("workspace.settings.feedback_directories.nav_label")}
              </Link>
            </Button>
          ) : undefined
        }>
        <UnifyFeedbackNavigation organizationId={organizationId} />
      </PageHeader>

      <div className="space-y-4">
        <DatasetSelector datasets={datasets} selectedId={selectedDatasetId} onChange={handleDatasetChange} />

        <DatasetOverviewHeader overview={view.overview} locale={resolvedLocale} />

        <FeedbackRecordsTable
          key={selectedDatasetId}
          organizationId={organizationId}
          datasetId={selectedDatasetId}
          datasetName={selectedDatasetName}
          initialRecords={view.records}
          initialCursor={view.cursor}
          sourceOptions={view.sourceOptions}
          csvSources={view.csvSources}
          canWrite={view.canWrite}
          surveyWorkspaceMap={view.surveyWorkspaceMap}
        />
      </div>
    </PageContentWrapper>
  );
}
