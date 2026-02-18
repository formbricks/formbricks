"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { TConnectorWithMappings, TFormbricksConnector } from "@formbricks/types/connector";
import {
  createConnectorAction,
  deleteConnectorAction,
  getConnectorsWithMappingsAction,
  syncFieldMappingsAction,
  syncFormbricksMappingsAction,
  updateConnectorAction,
} from "@/lib/connector/actions";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { UnifyConfigNavigation } from "../../components/UnifyConfigNavigation";
import { getSurveysForUnifyAction } from "../actions";
import { TSourceConnection, TUnifySurvey } from "../types";
import { elementTypeToHubFieldType } from "../utils";
import { CreateSourceModal } from "./create-source-modal";
import { EditSourceModal } from "./edit-source-modal";
import { SourcesTable } from "./sources-table";

interface SourcesSectionProps {
  environmentId: string;
}

// Transform connector from database to TSourceConnection for UI
function connectorToSourceConnection(connector: TConnectorWithMappings): TSourceConnection {
  // For webhook (and other field-mapping connectors), include field mappings
  const mappings =
    connector.type === "webhook" && "fieldMappings" in connector && connector.fieldMappings?.length
      ? connector.fieldMappings.map((m) => ({
          sourceFieldId: m.sourceFieldId,
          targetFieldId: m.targetFieldId,
          staticValue: m.staticValue ?? undefined,
        }))
      : [];

  return {
    id: connector.id,
    name: connector.name,
    type: connector.type as TSourceConnection["type"],
    mappings,
    createdAt: connector.createdAt,
    updatedAt: connector.updatedAt,
  };
}

// Get Formbricks mapping data from a connector
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

  // All mappings for a Formbricks connector should be for the same survey (for now)
  const surveyId = mappings[0].surveyId;
  const elementIds = mappings.map((m) => m.elementId);

  return { surveyId, elementIds };
}

export function SourcesSection({ environmentId }: SourcesSectionProps) {
  const [sources, setSources] = useState<TSourceConnection[]>([]);
  const [connectorsMap, setConnectorsMap] = useState<Map<string, TConnectorWithMappings>>(new Map());
  const [surveys, setSurveys] = useState<TUnifySurvey[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<TSourceConnection | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch surveys and connectors on mount
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch surveys and connectors in parallel
      const [surveysResult, connectorsResult] = await Promise.all([
        getSurveysForUnifyAction({ environmentId }),
        getConnectorsWithMappingsAction({ environmentId }),
      ]);

      if (surveysResult?.data) {
        setSurveys(surveysResult.data);
      }

      if (connectorsResult?.data) {
        setSources(connectorsResult.data.map(connectorToSourceConnection));
        // Store the full connector data for editing
        const newConnectorsMap = new Map<string, TConnectorWithMappings>();
        connectorsResult.data.forEach((connector) => {
          newConnectorsMap.set(connector.id, connector);
        });
        setConnectorsMap(newConnectorsMap);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      toast.error("Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, [environmentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateSource = async (
    source: TSourceConnection,
    selectedSurveyId?: string,
    selectedElementIds?: string[]
  ) => {
    try {
      // Create the connector in the database
      const result = await createConnectorAction({
        environmentId,
        connectorInput: {
          name: source.name,
          type: source.type,
        },
      });

      if (!result?.data) {
        toast.error("Failed to create connector");
        return;
      }

      const connectorResult = result.data;
      if ("error" in connectorResult && connectorResult.error) {
        toast.error(connectorResult.error.message || "Failed to create connector");
        return;
      }

      const connector = "data" in connectorResult ? connectorResult.data : connectorResult;
      if (!connector || !connector.id) {
        toast.error("Failed to create connector - invalid response");
        return;
      }

      // If it's a Formbricks connector, create the mappings
      if (
        source.type === "formbricks" &&
        selectedSurveyId &&
        selectedElementIds &&
        selectedElementIds.length > 0
      ) {
        // Get the survey to determine element types
        const selectedSurvey = surveys.find((s) => s.id === selectedSurveyId);
        if (selectedSurvey) {
          const mappings = selectedElementIds.map((elementId) => {
            const element = selectedSurvey.elements.find((e) => e.id === elementId);
            return {
              surveyId: selectedSurveyId,
              elementId,
              hubFieldType: elementTypeToHubFieldType(element?.type || "openText"),
            };
          });

          await syncFormbricksMappingsAction({
            connectorId: connector.id,
            mappings,
          });
        }
      } else if (source.type !== "formbricks" && source.mappings.length > 0) {
        // For other connector types, save field mappings
        const fieldMappings = source.mappings.map((m) => ({
          sourceFieldId: m.sourceFieldId || "",
          targetFieldId: m.targetFieldId,
          staticValue: m.staticValue,
        }));

        await syncFieldMappingsAction({
          connectorId: connector.id,
          mappings: fieldMappings,
        });
      }

      // Refresh the list
      await fetchData();
      toast.success("Connector created successfully");
    } catch (error) {
      console.error("Failed to create connector:", error);
      toast.error("Failed to create connector");
    }
  };

  const handleUpdateSource = async (
    updatedSource: TSourceConnection,
    selectedSurveyId?: string,
    selectedElementIds?: string[]
  ) => {
    try {
      // Update the connector name
      const result = await updateConnectorAction({
        connectorId: updatedSource.id,
        connectorInput: {
          name: updatedSource.name,
        },
      });

      if (!result?.data) {
        toast.error("Failed to update connector");
        return;
      }

      // If it's a Formbricks connector, update the mappings
      if (
        updatedSource.type === "formbricks" &&
        selectedSurveyId &&
        selectedElementIds &&
        selectedElementIds.length > 0
      ) {
        const selectedSurvey = surveys.find((s) => s.id === selectedSurveyId);
        if (selectedSurvey) {
          const mappings = selectedElementIds.map((elementId) => {
            const element = selectedSurvey.elements.find((e) => e.id === elementId);
            return {
              surveyId: selectedSurveyId,
              elementId,
              hubFieldType: elementTypeToHubFieldType(element?.type || "openText"),
            };
          });

          await syncFormbricksMappingsAction({
            connectorId: updatedSource.id,
            mappings,
          });
        }
      } else if (updatedSource.type !== "formbricks" && updatedSource.mappings.length > 0) {
        // For other connector types, save field mappings
        const fieldMappings = updatedSource.mappings.map((m) => ({
          sourceFieldId: m.sourceFieldId || "",
          targetFieldId: m.targetFieldId,
          staticValue: m.staticValue,
        }));

        await syncFieldMappingsAction({
          connectorId: updatedSource.id,
          mappings: fieldMappings,
        });
      }

      // Refresh the list
      await fetchData();
      toast.success("Connector updated successfully");
    } catch (error) {
      console.error("Failed to update connector:", error);
      toast.error("Failed to update connector");
    }
  };

  const handleDeleteSource = async (sourceId: string) => {
    try {
      const result = await deleteConnectorAction({
        connectorId: sourceId,
      });

      if (!result?.data) {
        toast.error("Failed to delete connector");
        return;
      }

      // Refresh the list
      await fetchData();
      toast.success("Connector deleted successfully");
    } catch (error) {
      console.error("Failed to delete connector:", error);
      toast.error("Failed to delete connector");
    }
  };

  const handleSourceClick = (source: TSourceConnection) => {
    setEditingSource(source);
  };

  return (
    <PageContentWrapper>
      <PageHeader
        pageTitle="Unify Feedback"
        cta={
          <CreateSourceModal
            open={isCreateModalOpen}
            onOpenChange={setIsCreateModalOpen}
            onCreateSource={handleCreateSource}
            surveys={surveys}
          />
        }>
        <UnifyConfigNavigation environmentId={environmentId} />
      </PageHeader>

      <div className="space-y-6">
        <SourcesTable sources={sources} onSourceClick={handleSourceClick} isLoading={isLoading} />
      </div>

      <EditSourceModal
        source={editingSource}
        open={editingSource !== null}
        onOpenChange={(open) => !open && setEditingSource(null)}
        onUpdateSource={handleUpdateSource}
        onDeleteSource={handleDeleteSource}
        surveys={surveys}
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
