"use client";

import { Loader2Icon, PlusIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TConnectorType, UNSUPPORTED_CONNECTOR_ELEMENT_TYPES } from "@formbricks/types/connector";
import {
  getResponseCountAction,
  importCsvDataAction,
  importHistoricalResponsesAction,
} from "@/lib/connector/actions";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { Alert } from "@/modules/ui/components/alert";
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
import { TEnumValidationError, parseCSVColumnsToFields, validateEnumMappings } from "../utils";
import { ConnectorTypeSelector } from "./connector-type-selector";
import { CsvConnectorUI } from "./csv-connector-ui";
import { FormbricksSurveySelector } from "./formbricks-survey-selector";

interface CreateConnectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateConnector: (data: {
    name: string;
    type: TConnectorType;
    surveyMappings?: { surveyId: string; elementIds: string[] }[];
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
  if (type === "formbricks") return t("environments.unify.select_questions");
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

interface AggregateImportSectionProps {
  surveyEntries: {
    surveyId: string;
    surveyName: string;
    responseCount: number;
    elementCount: number;
    importHistorical: boolean;
  }[];
  onImportHistoricalChange: (surveyId: string, checked: boolean) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

const AggregateImportSection = ({
  surveyEntries,
  onImportHistoricalChange,
  t,
}: AggregateImportSectionProps) => {
  const totalRecords = surveyEntries.reduce((sum, e) => sum + e.responseCount * e.elementCount, 0);
  const checkedCount = surveyEntries.filter((e) => e.importHistorical).length;

  const checkedTotal = surveyEntries
    .filter((e) => e.importHistorical)
    .reduce((sum, e) => sum + e.responseCount * e.elementCount, 0);

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="space-y-2">
        {surveyEntries.map((entry) => (
          <label key={entry.surveyId} className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={entry.importHistorical}
              onChange={(e) => onImportHistoricalChange(entry.surveyId, e.target.checked)}
              className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
            />
            <span className="text-xs text-amber-800">
              {t("environments.unify.survey_import_line", {
                surveyName: entry.surveyName,
                responseCount: entry.responseCount,
                questionCount: entry.elementCount,
                total: entry.responseCount * entry.elementCount,
              })}
            </span>
          </label>
        ))}
      </div>
      {surveyEntries.length > 1 && (
        <p className="mt-3 border-t border-amber-200 pt-2 text-xs font-medium text-amber-900">
          {t("environments.unify.total_feedback_records", {
            checked: checkedTotal,
            total: totalRecords,
            surveyCount: checkedCount,
          })}
        </p>
      )}
    </div>
  );
};

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
  const [elementIdsBySurvey, setElementIdsBySurvey] = useState<Record<string, string[]>>({});

  const [csvParsedData, setCsvParsedData] = useState<Record<string, string>[]>([]);

  const [enumValidationErrors, setEnumValidationErrors] = useState<TEnumValidationError[]>([]);

  const selectedElementIds = selectedSurveyId ? (elementIdsBySurvey[selectedSurveyId] ?? []) : [];

  const [responseCountBySurvey, setResponseCountBySurvey] = useState<Record<string, number | null>>({});
  const [importHistoricalBySurvey, setImportHistoricalBySurvey] = useState<Record<string, boolean>>({});
  const [isImporting, setIsImporting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const fetchResponseCount = useCallback(
    async (surveyId: string) => {
      if (responseCountBySurvey[surveyId] !== undefined) return;
      try {
        const result = await getResponseCountAction({ surveyId, environmentId });
        if (result?.data !== undefined) {
          setResponseCountBySurvey((prev) => ({ ...prev, [surveyId]: result.data ?? null }));
        }
      } catch {
        setResponseCountBySurvey((prev) => ({ ...prev, [surveyId]: null }));
      }
    },
    [environmentId, responseCountBySurvey]
  );

  useEffect(() => {
    if (selectedSurveyId && selectedType === "formbricks") {
      fetchResponseCount(selectedSurveyId);
    }
  }, [selectedSurveyId, selectedType, fetchResponseCount]);

  const resetForm = () => {
    setCurrentStep("selectType");
    setSelectedType(null);
    setConnectorName("");
    setMappings([]);
    setSourceFields([]);
    setCsvParsedData([]);
    setEnumValidationErrors([]);
    setSelectedSurveyId(null);
    setElementIdsBySurvey({});
    setResponseCountBySurvey({});
    setImportHistoricalBySurvey({});
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
        [surveyId]: survey.elements
          .filter((e) => !(UNSUPPORTED_CONNECTOR_ELEMENT_TYPES as readonly string[]).includes(e.type))
          .map((e) => e.id),
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

  const handleBack = () => {
    if (currentStep === "mapping") {
      setCurrentStep("selectType");
      setMappings([]);
      setSourceFields([]);
    }
  };

  const getSurveyMappings = () =>
    Object.entries(elementIdsBySurvey)
      .filter(([, ids]) => ids.length > 0)
      .map(([surveyId, elementIds]) => ({ surveyId, elementIds }));

  const handleHistoricalImports = async (connectorId: string) => {
    const surveysToImport = Object.entries(importHistoricalBySurvey)
      .filter(([surveyId, checked]) => checked && (elementIdsBySurvey[surveyId]?.length ?? 0) > 0)
      .map(([surveyId]) => surveyId);

    if (surveysToImport.length === 0) return;

    setIsImporting(true);
    let totalSuccesses = 0;
    let totalFailures = 0;
    let totalSkipped = 0;

    for (const surveyId of surveysToImport) {
      const importResult = await importHistoricalResponsesAction({
        connectorId,
        environmentId,
        surveyId,
      });

      if (importResult?.data) {
        totalSuccesses += importResult.data.successes;
        totalFailures += importResult.data.failures;
        totalSkipped += importResult.data.skipped;
      } else {
        toast.error(getFormattedErrorMessage(importResult));
      }
    }

    setIsImporting(false);

    if (totalSuccesses > 0 || totalFailures > 0) {
      toast.success(
        t("environments.unify.historical_import_complete", {
          successes: totalSuccesses,
          failures: totalFailures,
          skipped: totalSkipped,
        })
      );
    }
  };

  const handleCsvImport = async (connectorId: string) => {
    setIsImporting(true);
    const importResult = await importCsvDataAction({
      connectorId,
      environmentId,
      csvData: csvParsedData,
    });
    setIsImporting(false);

    if (importResult?.data) {
      toast.success(
        t("environments.unify.csv_import_complete", {
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

    if (selectedType === "csv" && csvParsedData.length > 0) {
      const errors = validateEnumMappings(mappings, csvParsedData);
      if (errors.length > 0) {
        setEnumValidationErrors(errors);
        return;
      }
      setEnumValidationErrors([]);
    }

    setIsCreating(true);

    const surveyMappings = getSurveyMappings();

    const connectorId = await onCreateConnector({
      name: connectorName.trim(),
      type: selectedType,
      surveyMappings: selectedType === "formbricks" && surveyMappings.length > 0 ? surveyMappings : undefined,
      fieldMappings: selectedType !== "formbricks" && mappings.length > 0 ? mappings : undefined,
    });

    if (connectorId && selectedType === "formbricks") {
      await handleHistoricalImports(connectorId);
    }

    if (connectorId && selectedType === "csv" && csvParsedData.length > 0) {
      await handleCsvImport(connectorId);
    }

    setIsCreating(false);
    resetForm();
    onOpenChange(false);
  };

  const requiredFields = FEEDBACK_RECORD_FIELDS.filter((f) => f.required);
  const allRequiredMapped = requiredFields.every((field) =>
    mappings.some((m) => m.targetFieldId === field.id && (m.sourceFieldId || m.staticValue))
  );

  const hasAnyElementSelections = Object.values(elementIdsBySurvey).some((ids) => ids.length > 0);
  const isFormbricksValid = selectedType === "formbricks" && hasAnyElementSelections;
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

                {(() => {
                  const entries = Object.entries(elementIdsBySurvey)
                    .filter(([, ids]) => ids.length > 0)
                    .map(([surveyId, ids]) => ({
                      surveyId,
                      surveyName: surveys.find((s) => s.id === surveyId)?.name ?? surveyId,
                      responseCount: responseCountBySurvey[surveyId] ?? 0,
                      elementCount: ids.length,
                      importHistorical: importHistoricalBySurvey[surveyId] ?? false,
                    }))
                    .filter((e) => e.responseCount > 0);

                  if (entries.length === 0) return null;

                  return (
                    <AggregateImportSection
                      surveyEntries={entries}
                      onImportHistoricalChange={(surveyId, checked) => {
                        setImportHistoricalBySurvey((prev) => ({ ...prev, [surveyId]: checked }));
                      }}
                      t={t}
                    />
                  );
                })()}
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
                    onMappingsChange={(m) => {
                      setMappings(m);
                      setEnumValidationErrors([]);
                    }}
                    onSourceFieldsChange={setSourceFields}
                    onLoadSampleCSV={handleLoadSourceFields}
                    onParsedDataChange={setCsvParsedData}
                  />
                </div>

                {enumValidationErrors.length > 0 && (
                  <Alert variant="error" size="small">
                    {enumValidationErrors.map((err) => {
                      const uniqueValues = [...new Set(err.invalidEntries.map((e) => e.value))];
                      const rowNumbers = err.invalidEntries.slice(0, 5).map((e) => e.row);
                      return (
                        <div key={err.targetFieldName} className="text-xs">
                          <p className="font-medium">
                            {t("environments.unify.invalid_enum_values", {
                              field: err.targetFieldName,
                            })}
                          </p>
                          <p>
                            {t("environments.unify.invalid_values_found", {
                              values: uniqueValues.join(", "),
                              rows: rowNumbers.join(", "),
                              extra: err.invalidEntries.length > 5 ? `+${err.invalidEntries.length - 5}` : "",
                            })}
                          </p>
                          <p className="mt-1 text-slate-500">
                            {t("environments.unify.allowed_values", {
                              values: err.allowedValues.join(", "),
                            })}
                          </p>
                        </div>
                      );
                    })}
                  </Alert>
                )}
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
