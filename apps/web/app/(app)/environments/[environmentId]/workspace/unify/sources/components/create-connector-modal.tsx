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

const getDialogTitle = (
  step: TCreateConnectorStep,
  type: TConnectorType | null,
  t: (key: string) => string
): string => {
  if (step === "selectType") return t("environments.unify.add_feedback_source");
  if (type === "formbricks") return t("environments.unify.select_survey_and_questions");
  if (type === "csv") return t("environments.unify.import_csv_data");
  return t("environments.unify.configure_mapping");
};

const getDialogDescription = (
  step: TCreateConnectorStep,
  type: TConnectorType | null,
  t: (key: string) => string
): string => {
  if (step === "selectType") return t("environments.unify.select_source_type_description");
  if (type === "formbricks") return t("environments.unify.select_survey_questions_description");
  if (type === "csv") return t("environments.unify.upload_csv_data_description");
  return t("environments.unify.configure_mapping");
};

const getNextStepButtonLabel = (type: TConnectorType | null, t: (key: string) => string): string => {
  if (type === "formbricks") return t("environments.unify.select_elements");
  if (type === "csv") return t("environments.unify.configure_import");
  return t("environments.unify.create_mapping");
};

const getCreateDisabled = (
  type: TConnectorType | null,
  isFormbricksValid: boolean,
  isCsvValid: boolean,
  allRequiredMapped: boolean
): boolean => {
  if (type === "formbricks") return !isFormbricksValid;
  if (type === "csv") return !isCsvValid;
  return !allRequiredMapped;
};

interface HistoricalImportSectionProps {
  responseCount: number;
  elementCount: number;
  totalFeedbackRecords: number;
  importHistorical: boolean;
  onImportHistoricalChange: (checked: boolean) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

const HistoricalImportSection = ({
  responseCount,
  elementCount,
  totalFeedbackRecords,
  importHistorical,
  onImportHistoricalChange,
  t,
}: HistoricalImportSectionProps) => (
  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
    <p className="mb-2 text-xs text-amber-800">
      {t("environments.unify.existing_responses_info", {
        responseCount,
        elementCount,
        total: totalFeedbackRecords,
      })}
    </p>
    <label className="flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        checked={importHistorical}
        onChange={(e) => onImportHistoricalChange(e.target.checked)}
        className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
      />
      <span className="text-sm font-medium text-amber-900">
        {t("environments.unify.import_existing_responses")}
      </span>
    </label>
  </div>
);

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
    if (isImporting) return;
    if (!newOpen) resetForm();
    onOpenChange(newOpen);
  };

  const handleNextStep = () => {
    if (currentStep !== "selectType" || !selectedType) return;

    const selectedSurvey = surveys.find((s) => s.id === selectedSurveyId);
    setConnectorName(
      selectedType === "formbricks" && selectedSurvey
        ? `${selectedSurvey.name} ${t("environments.unify.connection")}`
        : defaultConnectorName[selectedType]
    );
    setCurrentStep("mapping");
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

  const handleHistoricalImport = async (connectorId: string, surveyId: string) => {
    setIsImporting(true);
    const importResult = await importHistoricalResponsesAction({ connectorId, environmentId, surveyId });
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
  };

  const handleCreate = async () => {
    if (!selectedType || !connectorName.trim()) return;

    setIsCreating(true);

    const connectorId = await onCreateConnector({
      name: connectorName.trim(),
      type: selectedType,
      surveyId: selectedType === "formbricks" ? (selectedSurveyId ?? undefined) : undefined,
      elementIds: selectedType === "formbricks" ? selectedElementIds : undefined,
      fieldMappings: selectedType !== "formbricks" && mappings.length > 0 ? mappings : undefined,
    });

    if (connectorId && importHistorical && selectedSurveyId && selectedType === "formbricks") {
      await handleHistoricalImport(connectorId, selectedSurveyId);
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
            <DialogTitle>{getDialogTitle(currentStep, selectedType, t)}</DialogTitle>
            <DialogDescription>{getDialogDescription(currentStep, selectedType, t)}</DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {currentStep === "selectType" && (
              <ConnectorTypeSelector selectedType={selectedType} onSelectType={setSelectedType} />
            )}

            {currentStep === "mapping" && selectedType === "formbricks" && (
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

                {responseCount !== null &&
                  responseCount > 0 &&
                  selectedElementIds.length > 0 &&
                  totalFeedbackRecords !== null && (
                    <HistoricalImportSection
                      responseCount={responseCount}
                      elementCount={selectedElementIds.length}
                      totalFeedbackRecords={totalFeedbackRecords}
                      importHistorical={importHistorical}
                      onImportHistoricalChange={setImportHistorical}
                      t={t}
                    />
                  )}
              </div>
            )}

            {currentStep === "mapping" && selectedType === "csv" && (
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
            )}
          </div>

          <DialogFooter>
            {currentStep === "mapping" && (
              <Button variant="outline" onClick={handleBack} disabled={isCreating || isImporting}>
                {t("common.back")}
              </Button>
            )}
            {currentStep === "selectType" ? (
              <Button onClick={handleNextStep} disabled={!selectedType}>
                {getNextStepButtonLabel(selectedType, t)}
              </Button>
            ) : (
              <Button
                onClick={handleCreate}
                disabled={
                  isCreating ||
                  isImporting ||
                  !connectorName.trim() ||
                  getCreateDisabled(selectedType, !!isFormbricksValid, isCsvValid, allRequiredMapped)
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
