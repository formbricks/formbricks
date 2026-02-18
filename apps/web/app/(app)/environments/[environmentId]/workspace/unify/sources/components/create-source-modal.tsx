"use client";

import { PlusIcon, SparklesIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/modules/ui/components/badge";
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
  AI_SUGGESTED_MAPPINGS,
  FEEDBACK_RECORD_FIELDS,
  TCreateSourceStep,
  TFieldMapping,
  TSourceConnection,
  TSourceField,
  TSourceType,
  TUnifySurvey,
} from "../types";
import { parseCSVColumnsToFields } from "../utils";
import { CsvSourceUI } from "./csv-source-ui";
import { FormbricksSurveySelector } from "./formbricks-survey-selector";
import { MappingUI } from "./mapping-ui";
import { SourceTypeSelector } from "./source-type-selector";

interface CreateSourceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateSource: (
    source: TSourceConnection,
    selectedSurveyId?: string,
    selectedElementIds?: string[]
  ) => void;
  surveys: TUnifySurvey[];
}

function getDefaultSourceName(type: TSourceType): string {
  switch (type) {
    case "formbricks":
      return "Formbricks Survey Connection";
    case "csv":
      return "CSV Import";
    default:
      return "New Source";
  }
}

export function CreateSourceModal({ open, onOpenChange, onCreateSource, surveys }: CreateSourceModalProps) {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState<TCreateSourceStep>("selectType");
  const [selectedType, setSelectedType] = useState<TSourceType | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [mappings, setMappings] = useState<TFieldMapping[]>([]);
  const [sourceFields, setSourceFields] = useState<TSourceField[]>([]);

  // Formbricks-specific state
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);

  const resetForm = () => {
    setCurrentStep("selectType");
    setSelectedType(null);
    setSourceName("");
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

  const isDisabledType = (type: TSourceType) => type === "webhook" || type === "email" || type === "slack";

  const handleNextStep = () => {
    if (currentStep === "selectType" && selectedType && !isDisabledType(selectedType)) {
      if (selectedType === "formbricks") {
        const selectedSurvey = surveys.find((s) => s.id === selectedSurveyId);
        setSourceName(
          selectedSurvey ? `${selectedSurvey.name} Connection` : getDefaultSourceName(selectedType)
        );
      } else {
        setSourceName(getDefaultSourceName(selectedType));
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

  const handleCreateSource = () => {
    if (!selectedType || !sourceName.trim()) return;

    if (selectedType !== "formbricks") {
      const requiredFields = FEEDBACK_RECORD_FIELDS.filter((f) => f.required);
      const allRequiredMapped = requiredFields.every((field) =>
        mappings.some((m) => m.targetFieldId === field.id)
      );

      if (!allRequiredMapped) {
        console.warn("Not all required fields are mapped");
      }
    }

    const newSource: TSourceConnection = {
      id: crypto.randomUUID(),
      name: sourceName.trim(),
      type: selectedType,
      mappings,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    onCreateSource(
      newSource,
      selectedType === "formbricks" ? (selectedSurveyId ?? undefined) : undefined,
      selectedType === "formbricks" ? selectedElementIds : undefined
    );
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

  const handleSuggestMapping = () => {
    if (!selectedType) return;
    const suggestions = AI_SUGGESTED_MAPPINGS[selectedType];
    if (!suggestions) return;

    const newMappings: TFieldMapping[] = [];

    for (const sourceField of sourceFields) {
      const suggestedTarget = suggestions.fieldMappings[sourceField.id];
      if (suggestedTarget) {
        const targetExists = FEEDBACK_RECORD_FIELDS.find((f) => f.id === suggestedTarget);
        if (targetExists) {
          newMappings.push({
            sourceFieldId: sourceField.id,
            targetFieldId: suggestedTarget,
          });
        }
      }
    }

    for (const [targetFieldId, staticValue] of Object.entries(suggestions.staticValues)) {
      const targetExists = FEEDBACK_RECORD_FIELDS.find((f) => f.id === targetFieldId);
      if (targetExists) {
        if (!newMappings.some((m) => m.targetFieldId === targetFieldId)) {
          newMappings.push({
            targetFieldId,
            staticValue,
          });
        }
      }
    }

    setMappings(newMappings);
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
              <SourceTypeSelector selectedType={selectedType} onSelectType={setSelectedType} />
            ) : selectedType === "formbricks" ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sourceName">{t("environments.unify.source_name")}</Label>
                  <Input
                    id="sourceName"
                    value={sourceName}
                    onChange={(e) => setSourceName(e.target.value)}
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
                  <Label htmlFor="sourceName">{t("environments.unify.source_name")}</Label>
                  <Input
                    id="sourceName"
                    value={sourceName}
                    onChange={(e) => setSourceName(e.target.value)}
                    placeholder={t("environments.unify.enter_name_for_source")}
                  />
                </div>

                <div className="max-h-[55vh] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <CsvSourceUI
                    sourceFields={sourceFields}
                    mappings={mappings}
                    onMappingsChange={setMappings}
                    onSourceFieldsChange={setSourceFields}
                    onLoadSampleCSV={handleLoadSourceFields}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sourceName">{t("environments.unify.source_name")}</Label>
                  <Input
                    id="sourceName"
                    value={sourceName}
                    onChange={(e) => setSourceName(e.target.value)}
                    placeholder={t("environments.unify.enter_name_for_source")}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    {sourceFields.length > 0 && (
                      <Button variant="outline" size="sm" onClick={handleSuggestMapping} className="gap-2">
                        <SparklesIcon className="h-4 w-4 text-purple-500" />
                        {t("environments.unify.suggest_mapping")}
                        <Badge text="AI" type="gray" size="tiny" className="ml-1" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <MappingUI
                    sourceFields={sourceFields}
                    mappings={mappings}
                    onMappingsChange={setMappings}
                    sourceType={selectedType!}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            {currentStep === "mapping" && (
              <Button variant="outline" onClick={handleBack}>
                {t("common.back")}
              </Button>
            )}
            {currentStep === "selectType" ? (
              <Button onClick={handleNextStep} disabled={!selectedType || isDisabledType(selectedType)}>
                {selectedType === "formbricks"
                  ? t("environments.unify.select_questions")
                  : selectedType === "csv"
                    ? t("environments.unify.configure_import")
                    : t("environments.unify.create_mapping")}
              </Button>
            ) : (
              <Button
                onClick={handleCreateSource}
                disabled={
                  !sourceName.trim() ||
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
}
