"use client";

import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import {
  TFeedbackSourceType,
  TFeedbackSourceWithMappings,
  THubTargetField,
} from "@formbricks/types/feedback-source";
import { useWorkspace } from "@/app/(app)/workspaces/[workspaceId]/context/workspace-context";
import {
  createFeedbackSourceWithMappingsAction,
  deleteFeedbackSourceAction,
  updateFeedbackSourceWithMappingsAction,
} from "@/lib/feedback-source/actions";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { Alert, AlertButton, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { UnifyConfigNavigation } from "../../components/unify-config-navigation";
import { TFieldMapping, TUnifySurvey, getTranslatedFeedbackSourceError } from "../types";
import { CreateFeedbackSourceModal } from "./create-feedback-source-modal";
import { CsvImportModal } from "./csv-import-modal";
import { EditFeedbackSourceModal } from "./edit-feedback-source-modal";
import { FeedbackSourcesTable } from "./feedback-sources-table";

interface FeedbackSourcesSectionProps {
  workspaceId: string;
  initialFeedbackSources: TFeedbackSourceWithMappings[];
  initialSurveys: TUnifySurvey[];
  directories: { id: string; name: string }[];
  isReadOnly: boolean;
}

export function FeedbackSourcesSection({
  workspaceId,
  initialFeedbackSources,
  initialSurveys,
  directories,
  isReadOnly,
}: Readonly<FeedbackSourcesSectionProps>) {
  const { t } = useTranslation();
  const { workspace } = useWorkspace();
  const router = useRouter();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingFeedbackSource, setEditingFeedbackSource] = useState<TFeedbackSourceWithMappings | null>(
    null
  );
  const [csvImportFeedbackSource, setCsvImportFeedbackSource] = useState<TFeedbackSourceWithMappings | null>(
    null
  );
  const surveyNameById = useMemo(
    () => Object.fromEntries(initialSurveys.map((survey) => [survey.id, survey.name])),
    [initialSurveys]
  );
  // A survey can only back one feedback source, so surveys already connected are disabled in the picker.
  const connectedSurveyIds = useMemo(
    () =>
      initialFeedbackSources.flatMap((source) =>
        source.formbricksMappings.map((mapping) => mapping.surveyId)
      ),
    [initialFeedbackSources]
  );
  const directoryNames = directories.map((directory) => directory.name).join(", ");
  const feedbackDirectoryAccessText =
    directories.length === 1
      ? t("workspace.unify.feedback_sources_directory_access_single", {
          directoryNames,
        })
      : t("workspace.unify.feedback_sources_directory_access_multiple", {
          directoryNames,
        });

  const handleCreateFeedbackSource = async (data: {
    name: string;
    type: TFeedbackSourceType;
    feedbackDirectoryId: string;
    surveyMappings?: { surveyId: string; elementIds: string[] }[];
    fieldMappings?: TFieldMapping[];
  }): Promise<string | undefined> => {
    const result = await createFeedbackSourceWithMappingsAction({
      workspaceId: workspaceId,
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
      workspaceId: workspaceId,
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

  const handleDeleteFeedbackSource = async (feedbackSourceId: string): Promise<void> => {
    const result = await deleteFeedbackSourceAction({ feedbackSourceId, workspaceId: workspaceId });

    if (!result?.data) {
      toast.error(getTranslatedFeedbackSourceError(getFormattedErrorMessage(result), t));
      return;
    }

    toast.success(t("workspace.unify.source_deleted_successfully"));
    router.refresh();
  };

  const handleToggleStatus = async (feedbackSource: TFeedbackSourceWithMappings): Promise<void> => {
    const newStatus = feedbackSource.status === "active" ? "paused" : "active";
    const result = await updateFeedbackSourceWithMappingsAction({
      feedbackSourceId: feedbackSource.id,
      workspaceId: workspaceId,
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
      <PageHeader
        pageTitle={t("workspace.unify.feedback_data")}
        cta={
          isReadOnly ? undefined : (
            <Button size="sm" onClick={() => setIsCreateModalOpen(true)}>
              <PlusIcon className="mr-2 size-4" />
              {t("workspace.unify.add_feedback_source")}
            </Button>
          )
        }>
        <UnifyConfigNavigation workspaceId={workspaceId} activeId="sources" />
      </PageHeader>

      <FeedbackSourcesTable
        feedbackSources={initialFeedbackSources}
        surveyNameById={surveyNameById}
        onFeedbackSourceClick={setEditingFeedbackSource}
        onCsvImport={setCsvImportFeedbackSource}
        onToggleStatus={handleToggleStatus}
        onDelete={handleDeleteFeedbackSource}
        isLoading={false}
        isReadOnly={isReadOnly}
      />
      {directories.length > 0 && (
        <Alert size="small" className="mt-4">
          <AlertDescription>{feedbackDirectoryAccessText}</AlertDescription>
          {!isReadOnly && workspace?.organizationId && (
            <AlertButton asChild>
              <Link href={`/organizations/${workspace.organizationId}/settings/feedback-directories`}>
                {t("workspace.unify.manage_directories")}
              </Link>
            </AlertButton>
          )}
        </Alert>
      )}

      <CreateFeedbackSourceModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onCreateFeedbackSource={handleCreateFeedbackSource}
        surveys={initialSurveys}
        connectedSurveyIds={connectedSurveyIds}
        workspaceId={workspaceId}
        directories={directories}
        showTrigger={false}
      />

      <EditFeedbackSourceModal
        feedbackSource={editingFeedbackSource}
        isReadOnly={isReadOnly}
        open={editingFeedbackSource !== null}
        onOpenChange={(open) => !open && setEditingFeedbackSource(null)}
        onUpdateFeedbackSource={handleUpdateFeedbackSource}
        surveys={initialSurveys}
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
