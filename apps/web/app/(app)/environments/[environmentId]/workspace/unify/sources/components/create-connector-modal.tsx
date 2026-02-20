"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TConnectorType } from "@formbricks/types/connector";
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
import {
  FEEDBACK_RECORD_FIELDS,
  TCreateConnectorStep,
  TFieldMapping,
  TSourceField,
  TUnifySurvey,
} from "../types";
import { parseCSVColumnsToFields } from "../utils";
import { ConnectorTypeSelector } from "./connector-type-selector";
import { CsvConnectorUI } from "./csv-connector-ui";
import { FormbricksSurveySelector } from "./formbricks-survey-selector";

interface CreateConnectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateConnector: (data: {
    name: string;
    type: TConnectorType;
    surveyId?: string;
    elementIds?: string[];
    fieldMappings?: TFieldMapping[];
  }) => void;
  surveys: TUnifySurvey[];
}

const DEFAULT_CONNECTOR_NAME = {
  formbricks: "Formbricks Survey Connection",
  csv: "CSV Import",
};

export const CreateConnectorModal = ({
  open,
  onOpenChange,
  onCreateConnector,
  surveys,
}: CreateConnectorModalProps) => {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState<TCreateConnectorStep>("selectType");
  const [selectedType, setSelectedType] = useState<TConnectorType | null>(null);
  const [connectorName, setConnectorName] = useState("");
  const [mappings, setMappings] = useState<TFieldMapping[]>([]);
  const [sourceFields, setSourceFields] = useState<TSourceField[]>([]);

  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);

  const resetForm = () => {
    setCurrentStep("selectType");
    setSelectedType(null);
    setConnectorName("");
    setMappings([]);
    setSourceFields([]);
    setSelectedSurveyId(null);
    setSelectedElementIds([]);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const handleNextStep = () => {
    if (currentStep === "selectType" && selectedType) {
      if (selectedType === "formbricks") {
        const selectedSurvey = surveys.find((s) => s.id === selectedSurveyId);

        setConnectorName(
          selectedSurvey ? `${selectedSurvey.name} Connection` : DEFAULT_CONNECTOR_NAME[selectedType]
        );
      } else {
        setConnectorName(DEFAULT_CONNECTOR_NAME[selectedType]);
      }

      setCurrentStep("mapping");
    }
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

  const handleBack = () => {
    if (currentStep === "mapping") {
      setCurrentStep("selectType");
      setMappings([]);
      setSourceFields([]);
    }
  };

  const handleCreate = () => {
    if (!selectedType || !connectorName.trim()) return;

    if (selectedType !== "formbricks") {
      const requiredFields = FEEDBACK_RECORD_FIELDS.filter((f) => f.required);
      const allRequired = requiredFields.every((field) => mappings.some((m) => m.targetFieldId === field.id));

      if (!allRequired) {
        console.warn("Not all required fields are mapped");
      }
    }

    onCreateConnector({
      name: connectorName.trim(),
      type: selectedType,
      surveyId: selectedType === "formbricks" ? (selectedSurveyId ?? undefined) : undefined,
      elementIds: selectedType === "formbricks" ? selectedElementIds : undefined,
      fieldMappings: selectedType !== "formbricks" && mappings.length > 0 ? mappings : undefined,
    });
    resetForm();
    onOpenChange(false);
  };

  const requiredFields = FEEDBACK_RECORD_FIELDS.filter((f) => f.required);
  const allRequiredMapped = requiredFields.every((field) =>
    mappings.some((m) => m.targetFieldId === field.id && (m.sourceFieldId || m.staticValue))
  );

  const isFormbricksValid =
    selectedType === "formbricks" && selectedSurveyId && selectedElementIds.length > 0;
  const isCsvValid = selectedType === "csv" && sourceFields.length > 0;

  const handleLoadSourceFields = () => {
    if (selectedType === "csv") {
      const fields = parseCSVColumnsToFields("timestamp,customer_id,rating,feedback_text,category");
      setSourceFields(fields);
    }
  };

  return (
    <>
      <Button onClick={() => onOpenChange(true)} size="sm">
        {t("environments.unify.add_source")}
        <PlusIcon className="ml-2 h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {currentStep === "selectType"
                ? t("environments.unify.add_feedback_source")
                : selectedType === "formbricks"
                  ? t("environments.unify.select_survey_and_questions")
                  : selectedType === "csv"
                    ? t("environments.unify.import_csv_data")
                    : t("environments.unify.configure_mapping")}
            </DialogTitle>
            <DialogDescription>
              {currentStep === "selectType"
                ? t("environments.unify.select_source_type_description")
                : selectedType === "formbricks"
                  ? t("environments.unify.select_survey_questions_description")
                  : selectedType === "csv"
                    ? t("environments.unify.upload_csv_data_description")
                    : t("environments.unify.configure_mapping")}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {currentStep === "selectType" ? (
              <ConnectorTypeSelector selectedType={selectedType} onSelectType={setSelectedType} />
            ) : selectedType === "formbricks" ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="connectorName">{t("environments.unify.source_name")}</Label>
                  <Input
                    id="connectorName"
                    value={connectorName}
                    onChange={(e) => setConnectorName(e.target.value)}
                    placeholder={t("environments.unify.enter_name_for_source")}
                  />
                </div>

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
              </div>
            ) : selectedType === "csv" ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="connectorName">{t("environments.unify.source_name")}</Label>
                  <Input
                    id="connectorName"
                    value={connectorName}
                    onChange={(e) => setConnectorName(e.target.value)}
                    placeholder={t("environments.unify.enter_name_for_source")}
                  />
                </div>

                <div className="max-h-[55vh] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <CsvConnectorUI
                    sourceFields={sourceFields}
                    mappings={mappings}
                    onMappingsChange={setMappings}
                    onSourceFieldsChange={setSourceFields}
                    onLoadSampleCSV={handleLoadSourceFields}
                  />
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            {currentStep === "mapping" && (
              <Button variant="outline" onClick={handleBack}>
                {t("common.back")}
              </Button>
            )}
            {currentStep === "selectType" ? (
              <Button onClick={handleNextStep} disabled={!selectedType}>
                {selectedType === "formbricks"
                  ? t("environments.unify.select_questions")
                  : selectedType === "csv"
                    ? t("environments.unify.configure_import")
                    : t("environments.unify.create_mapping")}
              </Button>
            ) : (
              <Button
                onClick={handleCreate}
                disabled={
                  !connectorName.trim() ||
                  (selectedType === "formbricks"
                    ? !isFormbricksValid
                    : selectedType === "csv"
                      ? !isCsvValid
                      : !allRequiredMapped)
                }>
                {t("environments.unify.setup_connection")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
