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
  importHistoricalResponsesAction,
  updateFeedbackSourceWithMappingsAction,
} from "@/lib/feedback-source/actions";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { Alert, AlertButton, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { UnifyConfigNavigation } from "../../components/unify-config-navigation";
import { TFieldMapping, TUnifySurvey, getTranslatedFeedbackSourceError } from "../types";
import { getSelectableQuestionIds } from "../utils";
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
  // Survey to prefill the create modal with when opened from a "Select questions for import" suggestion.
  const [prefillSurveyId, setPrefillSurveyId] = useState<string | null>(null);
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
  // Surveys that aren't backing a source yet are surfaced as "Suggestions" below the table.
  const suggestedSurveys = useMemo(() => {
    const connectedSurveyIdSet = new Set(connectedSurveyIds);
    return initialSurveys.filter((survey) => !connectedSurveyIdSet.has(survey.id));
  }, [initialSurveys, connectedSurveyIds]);
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

  // "Select questions for import": open the create modal prefilled with the suggested survey.
  const handleSelectQuestions = (survey: TUnifySurvey): void => {
    setPrefillSurveyId(survey.id);
    setIsCreateModalOpen(true);
  };

  // "Import responses": one-click create the source (all supported questions) and import historical data.
  const handleImportResponses = async (survey: TUnifySurvey): Promise<void> => {
    const feedbackDirectoryId = directories[0]?.id;
    if (!feedbackDirectoryId) {
      toast.error(t("workspace.unify.no_feedback_directory_available"));
      return;
    }

    const elementIds = getSelectableQuestionIds(survey);
    if (elementIds.length === 0) {
      toast.error(t("workspace.unify.error_source_questions_required"));
      return;
    }

    const feedbackSourceId = await handleCreateFeedbackSource({
      name: t("workspace.unify.source_connector_name", { surveyName: survey.name }),
      type: "formbricks_survey",
      feedbackDirectoryId,
      surveyMappings: [{ surveyId: survey.id, elementIds }],
    });

    if (!feedbackSourceId) {
      return;
    }

    try {
      const importResult = await importHistoricalResponsesAction({
        feedbackSourceId,
        workspaceId,
        surveyId: survey.id,
      });

      if (importResult?.data) {
        toast.success(
          t("workspace.unify.historical_import_complete", {
            successes: importResult.data.successes,
            failures: importResult.data.failures,
            skipped: importResult.data.skipped,
          })
        );
      } else {
        // The source was created; only the historical import failed.
        toast.error(getTranslatedFeedbackSourceError(getFormattedErrorMessage(importResult), t));
      }
    } catch {
      toast.error(t("common.something_went_wrong"));
    }

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
        suggestedSurveys={suggestedSurveys}
        workspaceId={workspaceId}
        onFeedbackSourceClick={setEditingFeedbackSource}
        onCsvImport={setCsvImportFeedbackSource}
        onToggleStatus={handleToggleStatus}
        onDelete={handleDeleteFeedbackSource}
        onImportResponses={handleImportResponses}
        onSelectQuestions={handleSelectQuestions}
        isLoading={false}
        isReadOnly={isReadOnly}
      />
      {directories.length > 0 && (
        <Alert size="small" className="mt-4" role="status">
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
        onOpenChange={(open) => {
          setIsCreateModalOpen(open);
          if (!open) setPrefillSurveyId(null);
        }}
        onCreateFeedbackSource={handleCreateFeedbackSource}
        surveys={initialSurveys}
        connectedSurveyIds={connectedSurveyIds}
        workspaceId={workspaceId}
        directories={directories}
        initialSurveyId={prefillSurveyId}
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
