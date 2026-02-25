"use client";

import { Loader2Icon, PlusIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TConnectorType, UNSUPPORTED_CONNECTOR_ELEMENT_TYPES } from "@formbricks/types/connector";
import { getResponseCountAction, importHistoricalResponsesAction } from "@/lib/connector/actions";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
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
  }) => Promise<string | undefined>;
  surveys: TUnifySurvey[];
  environmentId: string;
}

export const CreateConnectorModal = ({
  open,
  onOpenChange,
  onCreateConnector,
  surveys,
  environmentId,
}: CreateConnectorModalProps) => {
  const { t } = useTranslation();

  const defaultConnectorName: Record<TConnectorType, string> = {
    formbricks: t("environments.unify.default_connector_name_formbricks"),
    csv: t("environments.unify.default_connector_name_csv"),
  };
  const [currentStep, setCurrentStep] = useState<TCreateConnectorStep>("selectType");
  const [selectedType, setSelectedType] = useState<TConnectorType | null>(null);
  const [connectorName, setConnectorName] = useState("");
  const [mappings, setMappings] = useState<TFieldMapping[]>([]);
  const [sourceFields, setSourceFields] = useState<TSourceField[]>([]);

  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);

  const [responseCount, setResponseCount] = useState<number | null>(null);
  const [importHistorical, setImportHistorical] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const fetchResponseCount = useCallback(
    async (surveyId: string) => {
      setResponseCount(null);
      try {
        const result = await getResponseCountAction({ surveyId, environmentId });
        if (result?.data !== undefined) {
          setResponseCount(result.data);
        }
      } catch {
        setResponseCount(null);
      }
    },
    [environmentId]
  );

  useEffect(() => {
    if (selectedSurveyId && selectedType === "formbricks") {
      fetchResponseCount(selectedSurveyId);
    } else {
      setResponseCount(null);
    }
  }, [selectedSurveyId, selectedType, fetchResponseCount]);

  const resetForm = () => {
    setCurrentStep("selectType");
    setSelectedType(null);
    setConnectorName("");
    setMappings([]);
    setSourceFields([]);
    setSelectedSurveyId(null);
    setSelectedElementIds([]);
    setResponseCount(null);
    setImportHistorical(false);
    setIsImporting(false);
    setIsCreating(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !isImporting) {
      resetForm();
    }
    if (!isImporting) {
      onOpenChange(newOpen);
    }
  };

  const handleNextStep = () => {
    if (currentStep === "selectType" && selectedType) {
      if (selectedType === "formbricks") {
        const selectedSurvey = surveys.find((s) => s.id === selectedSurveyId);

        setConnectorName(
          selectedSurvey
            ? `${selectedSurvey.name} ${t("environments.unify.connection")}`
            : defaultConnectorName[selectedType]
        );
      } else {
        setConnectorName(defaultConnectorName[selectedType]);
      }

      setCurrentStep("mapping");
    }
  };

  const handleSurveySelect = (surveyId: string | null) => {
    setSelectedSurveyId(surveyId);
    setImportHistorical(false);
  };

  const handleElementToggle = (elementId: string) => {
    setSelectedElementIds((prev) =>
      prev.includes(elementId) ? prev.filter((id) => id !== elementId) : [...prev, elementId]
    );
  };

  const handleSelectAllElements = (surveyId: string) => {
    const survey = surveys.find((s) => s.id === surveyId);
    if (survey) {
      setSelectedElementIds(
        survey.elements
          .filter((e) => !(UNSUPPORTED_CONNECTOR_ELEMENT_TYPES as readonly string[]).includes(e.type))
          .map((e) => e.id)
      );
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

  const handleCreate = async () => {
    if (!selectedType || !connectorName.trim()) return;

    if (selectedType !== "formbricks") {
      const requiredFields = FEEDBACK_RECORD_FIELDS.filter((f) => f.required);
      const allRequired = requiredFields.every((field) => mappings.some((m) => m.targetFieldId === field.id));

      if (!allRequired) {
        console.warn("Not all required fields are mapped");
      }
    }

    setIsCreating(true);

    const connectorId = await onCreateConnector({
      name: connectorName.trim(),
      type: selectedType,
      surveyId: selectedType === "formbricks" ? (selectedSurveyId ?? undefined) : undefined,
      elementIds: selectedType === "formbricks" ? selectedElementIds : undefined,
      fieldMappings: selectedType !== "formbricks" && mappings.length > 0 ? mappings : undefined,
    });

    if (connectorId && importHistorical && selectedSurveyId && selectedType === "formbricks") {
      setIsImporting(true);
      const importResult = await importHistoricalResponsesAction({
        connectorId,
        environmentId,
        surveyId: selectedSurveyId,
      });

      setIsImporting(false);

      if (importResult?.data) {
        toast.success(
          t("environments.unify.historical_import_complete", {
            successes: importResult.data.successes,
            failures: importResult.data.failures,
            skipped: importResult.data.skipped,
          })
        );
      } else {
        toast.error(getFormattedErrorMessage(importResult));
      }
    }

    setIsCreating(false);
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

  const totalFeedbackRecords =
    responseCount !== null && selectedElementIds.length > 0
      ? responseCount * selectedElementIds.length
      : null;

  return (
    <>
      <Button onClick={() => onOpenChange(true)} size="sm">
        {t("environments.unify.add_source")}
        <PlusIcon className="ml-2 h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-3xl">
          {isImporting && (
            <div className="absolute inset-0 z-50 flex items-center justify-center rounded-lg bg-white/80">
              <div className="flex flex-col items-center gap-3">
                <Loader2Icon className="h-8 w-8 animate-spin text-slate-500" />
                <p className="text-sm font-medium text-slate-700">
                  {t("environments.unify.importing_historical_data")}
                </p>
              </div>
            </div>
          )}

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

                {responseCount !== null && responseCount > 0 && selectedElementIds.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <p className="mb-2 text-xs text-amber-800">
                      {t("environments.unify.existing_responses_info", {
                        responseCount,
                        elementCount: selectedElementIds.length,
                        total: totalFeedbackRecords,
                      })}
                    </p>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={importHistorical}
                        onChange={(e) => setImportHistorical(e.target.checked)}
                        className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-sm font-medium text-amber-900">
                        {t("environments.unify.import_existing_responses")}
                      </span>
                    </label>
                  </div>
                )}
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
              <Button variant="outline" onClick={handleBack} disabled={isCreating || isImporting}>
                {t("common.back")}
              </Button>
            )}
            {currentStep === "selectType" ? (
              <Button onClick={handleNextStep} disabled={!selectedType}>
                {selectedType === "formbricks"
                  ? t("environments.unify.select_elements")
                  : selectedType === "csv"
                    ? t("environments.unify.configure_import")
                    : t("environments.unify.create_mapping")}
              </Button>
            ) : (
              <Button
                onClick={handleCreate}
                disabled={
                  isCreating ||
                  isImporting ||
                  !connectorName.trim() ||
                  (selectedType === "formbricks"
                    ? !isFormbricksValid
                    : selectedType === "csv"
                      ? !isCsvValid
                      : !allRequiredMapped)
                }>
                {isCreating && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
                {t("environments.unify.setup_connection")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
