"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import {
  TFeedbackSourceType,
  TFeedbackSourceWithMappings,
  THubTargetField,
} from "@formbricks/types/feedback-source";
import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import {
  createFeedbackSourceWithMappingsAction,
  deleteFeedbackSourceAction,
  duplicateFeedbackSourceAction,
  updateFeedbackSourceWithMappingsAction,
} from "@/lib/feedback-source/actions";
import type { TFeedbackSourceWithMappingsAndContext } from "@/lib/feedback-source/service";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { organizationSettingsPath } from "@/modules/settings/lib/routes";
import { Alert, AlertButton, AlertDescription } from "@/modules/ui/components/alert";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { TFieldMapping, getTranslatedFeedbackSourceError } from "../types";
import { CreateFeedbackSourceModal } from "./create-feedback-source-modal";
import { CsvImportModal } from "./csv-import-modal";
import { EditFeedbackSourceModal } from "./edit-feedback-source-modal";
import { FeedbackSourcesTable } from "./feedback-sources-table";

export interface TFeedbackSourcesDataset {
  id: string;
  name: string;
  // Workspaces this dataset is assigned to that the current user may also create a source in. The
  // create modal offers exactly these as the source's target workspace.
  workspaceIds: string[];
}

interface FeedbackSourcesSectionProps {
  organizationId: string;
  initialFeedbackSources: TFeedbackSourceWithMappingsAndContext[];
  datasets: TFeedbackSourcesDataset[];
  // Names for every workspace the user can reach in this org, used to label the workspace picker.
  workspaces: { id: string; name: string }[];
  isReadOnly: boolean;
}

export function FeedbackSourcesSection({
  organizationId,
  initialFeedbackSources,
  datasets,
  workspaces,
  isReadOnly,
}: Readonly<FeedbackSourcesSectionProps>) {
  const { t } = useTranslation();
  const router = useRouter();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingFeedbackSource, setEditingFeedbackSource] = useState<TFeedbackSourceWithMappings | null>(
    null
  );
  const [csvImportFeedbackSource, setCsvImportFeedbackSource] = useState<TFeedbackSourceWithMappings | null>(
    null
  );

  const directoryNames = datasets.map((dataset) => dataset.name).join(", ");
  const feedbackDirectoryAccessText =
    datasets.length === 1
      ? t("workspace.unify.feedback_sources_directory_access_single", {
          directoryNames,
        })
      : t("workspace.unify.feedback_sources_directory_access_multiple", {
          directoryNames,
        });

  const handleCreateFeedbackSource = async (data: {
    name: string;
    type: TFeedbackSourceType;
    workspaceId: string;
    feedbackDirectoryId: string;
    surveyMappings?: { surveyId: string; elementIds: string[] }[];
    fieldMappings?: TFieldMapping[];
  }): Promise<string | undefined> => {
    const result = await createFeedbackSourceWithMappingsAction({
      workspaceId: data.workspaceId,
      feedbackSourceInput: {
        name: data.name,
        type: data.type,
        feedbackDirectoryId: data.feedbackDirectoryId,
      },
      formbricksMappings:
        data.type === "formbricks_survey" && data.surveyMappings?.length ? data.surveyMappings : undefined,
      fieldMappings:
        data.type !== "formbricks_survey" && data.fieldMappings?.length
          ? data.fieldMappings.map((m) => ({
              sourceFieldId: m.sourceFieldId || "",
              targetFieldId: m.targetFieldId as THubTargetField,
              staticValue: m.staticValue,
            }))
          : undefined,
    });

    if (!result?.data) {
      toast.error(getTranslatedFeedbackSourceError(getFormattedErrorMessage(result), t));
      return undefined;
    }

    router.refresh();
    return result.data.id;
  };

  const handleUpdateFeedbackSource = async (data: {
    feedbackSourceId: string;
    workspaceId: string;
    name: string;
    surveyMappings?: { surveyId: string; elementIds: string[] }[];
    fieldMappings?: TFieldMapping[];
  }): Promise<boolean> => {
    const result = await updateFeedbackSourceWithMappingsAction({
      feedbackSourceId: data.feedbackSourceId,
      workspaceId: data.workspaceId,
      feedbackSourceInput: {
        name: data.name,
      },
      formbricksMappings: data.surveyMappings?.length ? data.surveyMappings : undefined,
      fieldMappings: data.fieldMappings?.length
        ? data.fieldMappings.map((m) => ({
            sourceFieldId: m.sourceFieldId || "",
            targetFieldId: m.targetFieldId as THubTargetField,
            staticValue: m.staticValue,
          }))
        : undefined,
    });

    if (!result?.data) {
      toast.error(getTranslatedFeedbackSourceError(getFormattedErrorMessage(result), t));
      return false;
    }

    toast.success(t("workspace.unify.source_updated_successfully"));
    router.refresh();
    return true;
  };

  const handleDeleteFeedbackSource = async (feedbackSource: TFeedbackSourceWithMappings): Promise<void> => {
    const result = await deleteFeedbackSourceAction({
      feedbackSourceId: feedbackSource.id,
      workspaceId: feedbackSource.workspaceId,
    });

    if (!result?.data) {
      toast.error(getTranslatedFeedbackSourceError(getFormattedErrorMessage(result), t));
      return;
    }

    toast.success(t("workspace.unify.source_deleted_successfully"));
    router.refresh();
  };

  const handleDuplicateFeedbackSource = async (
    feedbackSource: TFeedbackSourceWithMappings
  ): Promise<void> => {
    const result = await duplicateFeedbackSourceAction({
      feedbackSourceId: feedbackSource.id,
      workspaceId: feedbackSource.workspaceId,
    });

    if (!result?.data) {
      toast.error(getTranslatedFeedbackSourceError(getFormattedErrorMessage(result), t));
      return;
    }

    toast.success(t("workspace.unify.source_duplicated_successfully"));
    router.refresh();
  };

  const handleToggleStatus = async (feedbackSource: TFeedbackSourceWithMappings): Promise<void> => {
    const newStatus = feedbackSource.status === "active" ? "paused" : "active";
    const result = await updateFeedbackSourceWithMappingsAction({
      feedbackSourceId: feedbackSource.id,
      workspaceId: feedbackSource.workspaceId,
      feedbackSourceInput: { status: newStatus },
    });

    if (!result?.data) {
      toast.error(getTranslatedFeedbackSourceError(getFormattedErrorMessage(result), t));
      return;
    }

    toast.success(t("workspace.unify.source_status_updated_successfully"));
    router.refresh();
  };

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("workspace.unify.feedback_sources")} />

      <SettingsCard
        title={t("workspace.unify.feedback_sources")}
        description={t("workspace.unify.feedback_sources_settings_description")}
        buttonInfo={
          isReadOnly
            ? undefined
            : {
                text: t("workspace.unify.add_source"),
                onClick: () => setIsCreateModalOpen(true),
                variant: "default",
              }
        }>
        <FeedbackSourcesTable
          feedbackSources={initialFeedbackSources}
          onFeedbackSourceClick={setEditingFeedbackSource}
          onCsvImport={setCsvImportFeedbackSource}
          onDuplicate={handleDuplicateFeedbackSource}
          onToggleStatus={handleToggleStatus}
          onDelete={handleDeleteFeedbackSource}
          isLoading={false}
          isReadOnly={isReadOnly}
        />
        {datasets.length > 0 && (
          <Alert size="small" className="mt-4">
            <AlertDescription>{feedbackDirectoryAccessText}</AlertDescription>
            {!isReadOnly && (
              <AlertButton asChild>
                <Link href={organizationSettingsPath(organizationId, "feedback-directories")}>
                  {t("workspace.unify.manage_directories")}
                </Link>
              </AlertButton>
            )}
          </Alert>
        )}
      </SettingsCard>

      <CreateFeedbackSourceModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onCreateFeedbackSource={handleCreateFeedbackSource}
        organizationId={organizationId}
        datasets={datasets}
        workspaces={workspaces}
        showTrigger={false}
      />

      <EditFeedbackSourceModal
        feedbackSource={editingFeedbackSource}
        isReadOnly={isReadOnly}
        organizationId={organizationId}
        open={editingFeedbackSource !== null}
        onOpenChange={(open) => !open && setEditingFeedbackSource(null)}
        onUpdateFeedbackSource={handleUpdateFeedbackSource}
        onOpenCsvImport={() => {
          if (editingFeedbackSource) {
            setCsvImportFeedbackSource(editingFeedbackSource);
          }
        }}
      />

      {csvImportFeedbackSource && (
        <CsvImportModal
          open={csvImportFeedbackSource !== null}
          onOpenChange={(open) => !open && setCsvImportFeedbackSource(null)}
          feedbackSourceId={csvImportFeedbackSource.id}
          workspaceId={csvImportFeedbackSource.workspaceId}
          fieldMappings={csvImportFeedbackSource.fieldMappings}
          onOpenEditFeedbackSource={() => {
            setEditingFeedbackSource(csvImportFeedbackSource);
          }}
        />
      )}
    </PageContentWrapper>
  );
}
