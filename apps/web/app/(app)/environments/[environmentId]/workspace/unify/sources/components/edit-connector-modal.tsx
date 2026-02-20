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
import { FormbricksSurveySelector } from "./formbricks-survey-selector";
import { MappingUI } from "./mapping-ui";

interface EditConnectorModalProps {
  connector: TConnectorWithMappings | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateConnector: (data: {
    connectorId: string;
    name: string;
    surveyId?: string;
    elementIds?: string[];
    fieldMappings?: TFieldMapping[];
  }) => void;
  onDeleteConnector: (connectorId: string) => void;
  surveys: TUnifySurvey[];
}

function getConnectorIcon(type: TConnectorType) {
  switch (type) {
    case "formbricks":
      return <GlobeIcon className="h-5 w-5 text-slate-500" />;
    case "csv":
      return <FileSpreadsheetIcon className="h-5 w-5 text-slate-500" />;
    default:
      return <GlobeIcon className="h-5 w-5 text-slate-500" />;
  }
}

function getConnectorTypeLabelKey(type: TConnectorType): string {
  switch (type) {
    case "formbricks":
      return "environments.unify.formbricks_surveys";
    case "csv":
      return "environments.unify.csv_import";
    default:
      return type;
  }
}

export function EditConnectorModal({
  connector,
  open,
  onOpenChange,
  onUpdateConnector,
  onDeleteConnector,
  surveys,
}: EditConnectorModalProps) {
  const { t } = useTranslation();
  const [connectorName, setConnectorName] = useState("");
  const [mappings, setMappings] = useState<TFieldMapping[]>([]);
  const [sourceFields, setSourceFields] = useState<TSourceField[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);

  useEffect(() => {
    if (connector) {
      setConnectorName(connector.name);

      if (connector.type === "formbricks") {
        const fbMappings = connector.formbricksMappings;
        setSelectedSurveyId(fbMappings.length > 0 ? fbMappings[0].surveyId : null);
        setSelectedElementIds(fbMappings.map((m) => m.elementId));
        setSourceFields([]);
        setMappings([]);
      } else if (connector.type === "csv") {
        setSourceFields(parseCSVColumnsToFields(SAMPLE_CSV_COLUMNS));
        setMappings(
          connector.fieldMappings.map((m) => ({
            sourceFieldId: m.sourceFieldId,
            targetFieldId: m.targetFieldId,
          }))
        );
        setSelectedSurveyId(null);
        setSelectedElementIds([]);
      } else {
        setSourceFields([]);
        setMappings([]);
        setSelectedSurveyId(null);
        setSelectedElementIds([]);
      }
    }
  }, [connector]);

  const resetForm = () => {
    setConnectorName("");
    setMappings([]);
    setSourceFields([]);
    setShowDeleteConfirm(false);
    setSelectedSurveyId(null);
    setSelectedElementIds([]);
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
    setSelectedElementIds((prev) =>
      prev.includes(elementId) ? prev.filter((id) => id !== elementId) : [...prev, elementId]
    );
  };

  const handleSelectAllElements = (surveyId: string) => {
    const survey = surveys.find((s) => s.id === surveyId);
    if (survey) {
      setSelectedElementIds(survey.elements.map((e) => e.id));
    }
  };

  const handleDeselectAllElements = () => {
    setSelectedElementIds([]);
  };

  const handleUpdate = () => {
    if (!connector || !connectorName.trim()) return;

    onUpdateConnector({
      connectorId: connector.id,
      name: connectorName.trim(),
      surveyId: connector.type === "formbricks" ? (selectedSurveyId ?? undefined) : undefined,
      elementIds: connector.type === "formbricks" ? selectedElementIds : undefined,
      fieldMappings: connector.type !== "formbricks" && mappings.length > 0 ? mappings : undefined,
    });
    handleOpenChange(false);
  };

  const handleDelete = () => {
    if (!connector) return;
    onDeleteConnector(connector.id);
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
            <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4">
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
            <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4">
              <MappingUI
                sourceFields={sourceFields}
                mappings={mappings}
                onMappingsChange={setMappings}
                connectorType={connector.type}
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <div>
            {showDeleteConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-600">{t("environments.unify.are_you_sure")}</span>
                <Button variant="destructive" size="sm" onClick={handleDelete}>
                  {t("environments.unify.yes_delete")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)}>
                  {t("common.cancel")}
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={() => setShowDeleteConfirm(true)}>
                {t("environments.unify.delete_source")}
              </Button>
            )}
          </div>
          <Button
            onClick={handleUpdate}
            disabled={
              !connectorName.trim() ||
              (connector.type === "formbricks" && (!selectedSurveyId || selectedElementIds.length === 0))
            }>
            {t("environments.unify.save_changes")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
