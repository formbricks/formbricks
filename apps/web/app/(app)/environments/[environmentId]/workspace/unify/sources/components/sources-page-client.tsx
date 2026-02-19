"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TConnectorWithMappings, TFormbricksConnector, THubTargetField } from "@formbricks/types/connector";
import {
  createConnectorWithMappingsAction,
  deleteConnectorAction,
  updateConnectorWithMappingsAction,
} from "@/lib/connector/actions";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { UnifyConfigNavigation } from "../../components/UnifyConfigNavigation";
import { TSourceConnection, TUnifySurvey } from "../types";
import { CreateSourceModal } from "./create-source-modal";
import { EditSourceModal } from "./edit-source-modal";
import { SourcesTable } from "./sources-table";

interface SourcesSectionProps {
  environmentId: string;
  initialConnectors: TConnectorWithMappings[];
  initialSurveys: TUnifySurvey[];
}

function connectorToSourceConnection(connector: TConnectorWithMappings): TSourceConnection {
  return {
    id: connector.id,
    name: connector.name,
    type: connector.type as TSourceConnection["type"],
    mappings: [],
    createdAt: connector.createdAt,
    updatedAt: connector.updatedAt,
  };
}

function getFormbricksMappingData(connector: TConnectorWithMappings): {
  surveyId: string | null;
  elementIds: string[];
} {
  if (connector.type !== "formbricks" || !("formbricksMappings" in connector)) {
    return { surveyId: null, elementIds: [] };
  }

  const formbricksConnector = connector as TFormbricksConnector;
  const mappings = formbricksConnector.formbricksMappings || [];

  if (mappings.length === 0) {
    return { surveyId: null, elementIds: [] };
  }

  const surveyId = mappings[0].surveyId;
  const elementIds = mappings.map((m) => m.elementId);

  return { surveyId, elementIds };
}

export function SourcesSection({ environmentId, initialConnectors, initialSurveys }: SourcesSectionProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<TSourceConnection | null>(null);

  const sources = useMemo(() => initialConnectors.map(connectorToSourceConnection), [initialConnectors]);

  const connectorsMap = useMemo(() => {
    const map = new Map<string, TConnectorWithMappings>();
    initialConnectors.forEach((connector) => map.set(connector.id, connector));
    return map;
  }, [initialConnectors]);

  const handleCreateSource = async (
    source: TSourceConnection,
    selectedSurveyId?: string,
    selectedElementIds?: string[]
  ) => {
    const result = await createConnectorWithMappingsAction({
      environmentId,
      connectorInput: {
        name: source.name,
        type: source.type,
      },
      formbricksMappings:
        source.type === "formbricks" && selectedSurveyId && selectedElementIds?.length
          ? { surveyId: selectedSurveyId, elementIds: selectedElementIds }
          : undefined,
      fieldMappings:
        source.type !== "formbricks" && source.mappings.length > 0
          ? source.mappings.map((m) => ({
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

  const handleUpdateSource = async (
    updatedSource: TSourceConnection,
    selectedSurveyId?: string,
    selectedElementIds?: string[]
  ) => {
    const result = await updateConnectorWithMappingsAction({
      connectorId: updatedSource.id,
      connectorInput: {
        name: updatedSource.name,
      },
      formbricksMappings:
        updatedSource.type === "formbricks" && selectedSurveyId && selectedElementIds?.length
          ? { surveyId: selectedSurveyId, elementIds: selectedElementIds }
          : undefined,
      fieldMappings:
        updatedSource.type !== "formbricks" && updatedSource.mappings.length > 0
          ? updatedSource.mappings.map((m) => ({
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

  const handleDeleteSource = async (sourceId: string) => {
    const result = await deleteConnectorAction({
      connectorId: sourceId,
    });

    if (!result?.data) {
      toast.error(getFormattedErrorMessage(result));
      return;
    }

    toast.success(t("environments.unify.connector_deleted_successfully"));
    router.refresh();
  };

  const handleSourceClick = (source: TSourceConnection) => {
    setEditingSource(source);
  };

  return (
    <PageContentWrapper>
      <PageHeader
        pageTitle={t("environments.unify.unify_feedback")}
        cta={
          <CreateSourceModal
            open={isCreateModalOpen}
            onOpenChange={setIsCreateModalOpen}
            onCreateSource={handleCreateSource}
            surveys={initialSurveys}
          />
        }>
        <UnifyConfigNavigation environmentId={environmentId} />
      </PageHeader>

      <div className="space-y-6">
        <SourcesTable sources={sources} onSourceClick={handleSourceClick} isLoading={false} />
      </div>

      <EditSourceModal
        source={editingSource}
        open={editingSource !== null}
        onOpenChange={(open) => !open && setEditingSource(null)}
        onUpdateSource={handleUpdateSource}
        onDeleteSource={handleDeleteSource}
        surveys={initialSurveys}
        initialSurveyId={
          editingSource && connectorsMap.get(editingSource.id)
            ? getFormbricksMappingData(connectorsMap.get(editingSource.id)!).surveyId
            : null
        }
        initialElementIds={
          editingSource && connectorsMap.get(editingSource.id)
            ? getFormbricksMappingData(connectorsMap.get(editingSource.id)!).elementIds
            : []
        }
      />
    </PageContentWrapper>
  );
}
