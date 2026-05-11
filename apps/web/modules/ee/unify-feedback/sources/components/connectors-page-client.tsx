"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TConnectorType, TConnectorWithMappings, THubTargetField } from "@formbricks/types/connector";
import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import {
  createConnectorWithMappingsAction,
  deleteConnectorAction,
  duplicateConnectorAction,
  updateConnectorWithMappingsAction,
} from "@/lib/connector/actions";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { Alert, AlertButton, AlertDescription } from "@/modules/ui/components/alert";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { TFieldMapping, TUnifySurvey } from "../types";
import { ConnectorsTable } from "./connectors-table";
import { CreateConnectorModal } from "./create-connector-modal";
import { CsvImportModal } from "./csv-import-modal";
import { EditConnectorModal } from "./edit-connector-modal";

interface ConnectorsSectionProps {
  workspaceId: string;
  initialConnectors: TConnectorWithMappings[];
  initialSurveys: TUnifySurvey[];
  directories: { id: string; name: string }[];
  isReadOnly: boolean;
}

export function ConnectorsSection({
  workspaceId,
  initialConnectors,
  initialSurveys,
  directories,
  isReadOnly,
}: Readonly<ConnectorsSectionProps>) {
  const { t } = useTranslation();
  const router = useRouter();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingConnector, setEditingConnector] = useState<TConnectorWithMappings | null>(null);
  const [csvImportConnector, setCsvImportConnector] = useState<TConnectorWithMappings | null>(null);
  const directoryNames = directories.map((directory) => directory.name).join(", ");
  const feedbackDirectoryAccessText =
    directories.length === 1
      ? t("workspace.unify.feedback_sources_directory_access_single", {
          directoryNames,
        })
      : t("workspace.unify.feedback_sources_directory_access_multiple", {
          directoryNames,
        });

  const handleCreateConnector = async (data: {
    name: string;
    type: TConnectorType;
    feedbackDirectoryId: string;
    surveyMappings?: { surveyId: string; elementIds: string[] }[];
    fieldMappings?: TFieldMapping[];
  }): Promise<string | undefined> => {
    const result = await createConnectorWithMappingsAction({
      workspaceId: workspaceId,
      connectorInput: {
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
      toast.error(getFormattedErrorMessage(result));
      return undefined;
    }

    toast.success(t("workspace.unify.connector_created_successfully"));
    router.refresh();
    return result.data.id;
  };

  const handleUpdateConnector = async (data: {
    connectorId: string;
    workspaceId: string;
    name: string;
    surveyMappings?: { surveyId: string; elementIds: string[] }[];
    fieldMappings?: TFieldMapping[];
  }) => {
    const result = await updateConnectorWithMappingsAction({
      connectorId: data.connectorId,
      workspaceId: workspaceId,
      connectorInput: {
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
      toast.error(getFormattedErrorMessage(result));
      return;
    }

    toast.success(t("workspace.unify.connector_updated_successfully"));
    router.refresh();
  };

  const handleDeleteConnector = async (connectorId: string): Promise<void> => {
    const result = await deleteConnectorAction({ connectorId, workspaceId: workspaceId });

    if (!result?.data) {
      toast.error(getFormattedErrorMessage(result));
      return;
    }

    toast.success(t("workspace.unify.connector_deleted_successfully"));
    router.refresh();
  };

  const handleDuplicateConnector = async (connector: TConnectorWithMappings): Promise<void> => {
    const result = await duplicateConnectorAction({
      connectorId: connector.id,
      workspaceId: workspaceId,
    });

    if (!result?.data) {
      toast.error(getFormattedErrorMessage(result));
      return;
    }

    toast.success(t("workspace.unify.connector_duplicated_successfully"));
    router.refresh();
  };

  const handleToggleStatus = async (connector: TConnectorWithMappings): Promise<void> => {
    const newStatus = connector.status === "active" ? "paused" : "active";
    const result = await updateConnectorWithMappingsAction({
      connectorId: connector.id,
      workspaceId: workspaceId,
      connectorInput: { status: newStatus },
    });

    if (!result?.data) {
      toast.error(getFormattedErrorMessage(result));
      return;
    }

    toast.success(t("workspace.unify.connector_status_updated_successfully"));
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
        <ConnectorsTable
          connectors={initialConnectors}
          onConnectorClick={setEditingConnector}
          onCsvImport={setCsvImportConnector}
          onDuplicate={handleDuplicateConnector}
          onToggleStatus={handleToggleStatus}
          onDelete={handleDeleteConnector}
          isLoading={false}
          isReadOnly={isReadOnly}
        />
        {directories.length > 0 && (
          <Alert size="small" className="mt-4">
            <AlertDescription>{feedbackDirectoryAccessText}</AlertDescription>
            <AlertButton asChild>
              <Link href={`/workspaces/${workspaceId}/settings/organization/feedback-directories`}>
                {t("workspace.unify.manage_directories")}
              </Link>
            </AlertButton>
          </Alert>
        )}
      </SettingsCard>

      <CreateConnectorModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onCreateConnector={handleCreateConnector}
        surveys={initialSurveys}
        workspaceId={workspaceId}
        directories={directories}
        showTrigger={false}
      />

      <EditConnectorModal
        connector={editingConnector}
        isReadOnly={isReadOnly}
        open={editingConnector !== null}
        onOpenChange={(open) => !open && setEditingConnector(null)}
        onUpdateConnector={handleUpdateConnector}
        surveys={initialSurveys}
        onOpenCsvImport={() => {
          if (editingConnector) {
            setCsvImportConnector(editingConnector);
          }
        }}
      />

      {csvImportConnector && (
        <CsvImportModal
          open={csvImportConnector !== null}
          onOpenChange={(open) => !open && setCsvImportConnector(null)}
          connectorId={csvImportConnector.id}
          workspaceId={csvImportConnector.workspaceId}
          onOpenEditConnector={() => {
            setEditingConnector(csvImportConnector);
          }}
        />
      )}
    </PageContentWrapper>
  );
}
