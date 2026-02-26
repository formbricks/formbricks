"use client";

import { FileSpreadsheetIcon, GlobeIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { TConnectorType, TConnectorWithMappings } from "@formbricks/types/connector";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { SAMPLE_CSV_COLUMNS, TFieldMapping, TSourceField, TUnifySurvey } from "../types";
import { parseCSVColumnsToFields } from "../utils";
import { CsvImportSection } from "./csv-import-section";
import { FormbricksSurveySelector } from "./formbricks-survey-selector";
import { MappingUI } from "./mapping-ui";

interface EditConnectorModalProps {
  connector: TConnectorWithMappings | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateConnector: (data: {
    connectorId: string;
    environmentId: string;
    name: string;
    surveyMappings?: { surveyId: string; elementIds: string[] }[];
    fieldMappings?: TFieldMapping[];
  }) => Promise<void>;
  surveys: TUnifySurvey[];
}

const getConnectorIcon = (type: TConnectorType) => {
  switch (type) {
    case "formbricks":
      return <GlobeIcon className="h-5 w-5 text-slate-500" />;
    case "csv":
      return <FileSpreadsheetIcon className="h-5 w-5 text-slate-500" />;
    default:
      return <GlobeIcon className="h-5 w-5 text-slate-500" />;
  }
};

const getConnectorTypeLabelKey = (type: TConnectorType): string => {
  switch (type) {
    case "formbricks":
      return "environments.unify.formbricks_surveys";
    case "csv":
      return "environments.unify.csv_import";
    default:
      return type;
  }
};

const groupMappingsBySurvey = (
  mappings: { surveyId: string; elementId: string }[]
): Record<string, string[]> => {
  const grouped: Record<string, string[]> = {};
  for (const m of mappings) {
    if (!grouped[m.surveyId]) grouped[m.surveyId] = [];
    grouped[m.surveyId].push(m.elementId);
  }
  return grouped;
};

export const EditConnectorModal = ({
  connector,
  open,
  onOpenChange,
  onUpdateConnector,
  surveys,
}: EditConnectorModalProps) => {
  const { t } = useTranslation();
  const [connectorName, setConnectorName] = useState("");
  const [mappings, setMappings] = useState<TFieldMapping[]>([]);
  const [sourceFields, setSourceFields] = useState<TSourceField[]>([]);

  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null);
  const [elementIdsBySurvey, setElementIdsBySurvey] = useState<Record<string, string[]>>({});

  const selectedElementIds = selectedSurveyId ? (elementIdsBySurvey[selectedSurveyId] ?? []) : [];

  useEffect(() => {
    if (connector) {
      setConnectorName(connector.name);

      if (connector.type === "formbricks") {
        const fbMappings = connector.formbricksMappings;
        setSelectedSurveyId(fbMappings.length > 0 ? fbMappings[0].surveyId : null);
        setElementIdsBySurvey(groupMappingsBySurvey(fbMappings));
        setSourceFields([]);
        setMappings([]);
      } else if (connector.type === "csv") {
        const columnsFromMappings = [
          ...new Set(connector.fieldMappings.map((m) => m.sourceFieldId).filter(Boolean)),
        ];
        setSourceFields(
          columnsFromMappings.length > 0
            ? parseCSVColumnsToFields(columnsFromMappings.join(","))
            : parseCSVColumnsToFields(SAMPLE_CSV_COLUMNS)
        );
        setMappings(
          connector.fieldMappings.map((m) => ({
            sourceFieldId: m.sourceFieldId,
            targetFieldId: m.targetFieldId,
            staticValue: m.staticValue ?? undefined,
          }))
        );
        setSelectedSurveyId(null);
        setElementIdsBySurvey({});
      } else {
        setSourceFields([]);
        setMappings([]);
        setSelectedSurveyId(null);
        setElementIdsBySurvey({});
      }
    }
  }, [connector]);

  const resetForm = () => {
    setConnectorName("");
    setMappings([]);
    setSourceFields([]);
    setSelectedSurveyId(null);
    setElementIdsBySurvey({});
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const handleSurveySelect = (surveyId: string | null) => {
    setSelectedSurveyId(surveyId);
  };

  const handleElementToggle = (elementId: string) => {
    if (!selectedSurveyId) return;
    setElementIdsBySurvey((prev) => {
      const current = prev[selectedSurveyId] ?? [];
      return {
        ...prev,
        [selectedSurveyId]: current.includes(elementId)
          ? current.filter((id) => id !== elementId)
          : [...current, elementId],
      };
    });
  };

  const handleSelectAllElements = (surveyId: string) => {
    const survey = surveys.find((s) => s.id === surveyId);
    if (survey) {
      setElementIdsBySurvey((prev) => ({
        ...prev,
        [surveyId]: survey.elements.map((e) => e.id),
      }));
    }
  };

  const handleDeselectAllElements = () => {
    if (!selectedSurveyId) return;
    setElementIdsBySurvey((prev) => ({
      ...prev,
      [selectedSurveyId]: [],
    }));
  };

  const handleUpdate = async () => {
    if (!connector || !connectorName.trim()) return;

    const surveyMappings = Object.entries(elementIdsBySurvey)
      .filter(([, ids]) => ids.length > 0)
      .map(([surveyId, elementIds]) => ({ surveyId, elementIds }));

    await onUpdateConnector({
      connectorId: connector.id,
      environmentId: connector.environmentId,
      name: connectorName.trim(),
      surveyMappings:
        connector.type === "formbricks" && surveyMappings.length > 0 ? surveyMappings : undefined,
      fieldMappings: connector.type !== "formbricks" && mappings.length > 0 ? mappings : undefined,
    });
    handleOpenChange(false);
  };

  if (!connector) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("environments.unify.edit_source_connection")}</DialogTitle>
          <DialogDescription>{t("environments.unify.update_mapping_description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            {getConnectorIcon(connector.type)}
            <div>
              <p className="text-sm font-medium text-slate-900">
                {t(getConnectorTypeLabelKey(connector.type))}
              </p>
              <p className="text-xs text-slate-500">
                {t("environments.unify.source_type_cannot_be_changed")}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="editConnectorName">{t("environments.unify.source_name")}</Label>
            <Input
              id="editConnectorName"
              value={connectorName}
              onChange={(e) => setConnectorName(e.target.value)}
              placeholder={t("environments.unify.enter_name_for_source")}
            />
          </div>

          {connector.type === "formbricks" ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <FormbricksSurveySelector
                surveys={surveys}
                selectedSurveyId={selectedSurveyId}
                selectedElementIds={selectedElementIds}
                onSurveySelect={handleSurveySelect}
                onElementToggle={handleElementToggle}
                onSelectAllElements={handleSelectAllElements}
                onDeselectAllElements={handleDeselectAllElements}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="max-h-[40vh] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4">
                <MappingUI
                  sourceFields={sourceFields}
                  mappings={mappings}
                  onMappingsChange={setMappings}
                  connectorType={connector.type}
                />
              </div>

              {connector.type === "csv" && (
                <CsvImportSection connectorId={connector.id} environmentId={connector.environmentId} />
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleUpdate}
            disabled={
              !connectorName.trim() ||
              (connector.type === "formbricks" &&
                !Object.values(elementIdsBySurvey).some((ids) => ids.length > 0))
            }>
            {t("environments.unify.save_changes")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
