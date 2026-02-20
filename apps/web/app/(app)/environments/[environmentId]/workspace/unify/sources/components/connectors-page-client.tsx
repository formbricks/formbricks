"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TConnectorType, TConnectorWithMappings, THubTargetField } from "@formbricks/types/connector";
import {
  createConnectorWithMappingsAction,
  deleteConnectorAction,
  updateConnectorWithMappingsAction,
} from "@/lib/connector/actions";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { UnifyConfigNavigation } from "../../components/UnifyConfigNavigation";
import { TFieldMapping, TUnifySurvey } from "../types";
import { ConnectorsTable } from "./connectors-table";
import { CreateConnectorModal } from "./create-connector-modal";
import { EditConnectorModal } from "./edit-connector-modal";

interface ConnectorsSectionProps {
  environmentId: string;
  initialConnectors: TConnectorWithMappings[];
  initialSurveys: TUnifySurvey[];
}

export function ConnectorsSection({
  environmentId,
  initialConnectors,
  initialSurveys,
}: ConnectorsSectionProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingConnector, setEditingConnector] = useState<TConnectorWithMappings | null>(null);

  const handleCreateConnector = async (data: {
    name: string;
    type: TConnectorType;
    surveyId?: string;
    elementIds?: string[];
    fieldMappings?: TFieldMapping[];
  }) => {
    const result = await createConnectorWithMappingsAction({
      environmentId,
      connectorInput: {
        name: data.name,
        type: data.type,
      },
      formbricksMappings:
        data.type === "formbricks" && data.surveyId && data.elementIds?.length
          ? { surveyId: data.surveyId, elementIds: data.elementIds }
          : undefined,
      fieldMappings:
        data.type !== "formbricks" && data.fieldMappings?.length
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

    toast.success(t("environments.unify.connector_created_successfully"));
    router.refresh();
  };

  const handleUpdateConnector = async (data: {
    connectorId: string;
    name: string;
    surveyId?: string;
    elementIds?: string[];
    fieldMappings?: TFieldMapping[];
  }) => {
    const result = await updateConnectorWithMappingsAction({
      connectorId: data.connectorId,
      connectorInput: {
        name: data.name,
      },
      formbricksMappings:
        data.surveyId && data.elementIds?.length
          ? { surveyId: data.surveyId, elementIds: data.elementIds }
          : undefined,
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

    toast.success(t("environments.unify.connector_updated_successfully"));
    router.refresh();
  };

  const handleDeleteConnector = async (connectorId: string) => {
    const result = await deleteConnectorAction({ connectorId });

    if (!result?.data) {
      toast.error(getFormattedErrorMessage(result));
      return;
    }

    toast.success(t("environments.unify.connector_deleted_successfully"));
    router.refresh();
  };

  return (
    <PageContentWrapper>
      <PageHeader
        pageTitle={t("environments.unify.unify_feedback")}
        cta={
          <CreateConnectorModal
            open={isCreateModalOpen}
            onOpenChange={setIsCreateModalOpen}
            onCreateConnector={handleCreateConnector}
            surveys={initialSurveys}
          />
        }>
        <UnifyConfigNavigation environmentId={environmentId} />
      </PageHeader>

      <div className="space-y-6">
        <ConnectorsTable
          connectors={initialConnectors}
          onConnectorClick={setEditingConnector}
          isLoading={false}
        />
      </div>

      <EditConnectorModal
        connector={editingConnector}
        open={editingConnector !== null}
        onOpenChange={(open) => !open && setEditingConnector(null)}
        onUpdateConnector={handleUpdateConnector}
        onDeleteConnector={handleDeleteConnector}
        surveys={initialSurveys}
      />
    </PageContentWrapper>
  );
}
