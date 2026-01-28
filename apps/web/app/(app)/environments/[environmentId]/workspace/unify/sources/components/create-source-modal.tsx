"use client";

import { PlusIcon, SparklesIcon } from "lucide-react";
import { useState } from "react";
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
import { CsvSourceUI } from "./csv-source-ui";
import { FormbricksSurveySelector } from "./formbricks-survey-selector";
import { MappingUI } from "./mapping-ui";
import { SourceTypeSelector } from "./source-type-selector";
import {
  AI_SUGGESTED_MAPPINGS,
  EMAIL_SOURCE_FIELDS,
  FEEDBACK_RECORD_FIELDS,
  MOCK_FORMBRICKS_SURVEYS,
  SAMPLE_CSV_COLUMNS,
  SAMPLE_WEBHOOK_PAYLOAD,
  TCreateSourceStep,
  TFieldMapping,
  TSourceConnection,
  TSourceField,
  TSourceType,
  parseCSVColumnsToFields,
  parsePayloadToFields,
} from "./types";

interface CreateSourceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateSource: (source: TSourceConnection) => void;
}

function getDefaultSourceName(type: TSourceType): string {
  switch (type) {
    case "formbricks":
      return "Formbricks Survey Connection";
    case "webhook":
      return "Webhook Connection";
    case "email":
      return "Email Connection";
    case "csv":
      return "CSV Import";
    case "slack":
      return "Slack Connection";
    default:
      return "New Source";
  }
}

export function CreateSourceModal({ open, onOpenChange, onCreateSource }: CreateSourceModalProps) {
  const [currentStep, setCurrentStep] = useState<TCreateSourceStep>("selectType");
  const [selectedType, setSelectedType] = useState<TSourceType | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [mappings, setMappings] = useState<TFieldMapping[]>([]);
  const [sourceFields, setSourceFields] = useState<TSourceField[]>([]);
  const [deriveFromAttachments, setDeriveFromAttachments] = useState(false);

  // Formbricks-specific state
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);

  const resetForm = () => {
    setCurrentStep("selectType");
    setSelectedType(null);
    setSourceName("");
    setMappings([]);
    setSourceFields([]);
    setDeriveFromAttachments(false);
    setSelectedSurveyId(null);
    setSelectedQuestionIds([]);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const handleNextStep = () => {
    if (currentStep === "selectType" && selectedType && selectedType !== "slack") {
      if (selectedType === "formbricks") {
        // For Formbricks, use the survey name if selected
        const selectedSurvey = MOCK_FORMBRICKS_SURVEYS.find((s) => s.id === selectedSurveyId);
        setSourceName(
          selectedSurvey ? `${selectedSurvey.name} Connection` : getDefaultSourceName(selectedType)
        );
      } else {
        setSourceName(getDefaultSourceName(selectedType));
      }
      setCurrentStep("mapping");
    }
  };

  // Formbricks handlers
  const handleSurveySelect = (surveyId: string | null) => {
    setSelectedSurveyId(surveyId);
  };

  const handleQuestionToggle = (questionId: string) => {
    setSelectedQuestionIds((prev) =>
      prev.includes(questionId) ? prev.filter((id) => id !== questionId) : [...prev, questionId]
    );
  };

  const handleSelectAllQuestions = (surveyId: string) => {
    const survey = MOCK_FORMBRICKS_SURVEYS.find((s) => s.id === surveyId);
    if (survey) {
      setSelectedQuestionIds(survey.questions.map((q) => q.id));
    }
  };

  const handleDeselectAllQuestions = () => {
    setSelectedQuestionIds([]);
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

    // Check if all required fields are mapped
    const requiredFields = FEEDBACK_RECORD_FIELDS.filter((f) => f.required);
    const allRequiredMapped = requiredFields.every((field) =>
      mappings.some((m) => m.targetFieldId === field.id)
    );

    if (!allRequiredMapped) {
      // For now, we'll allow creating without all required fields for POC
      console.warn("Not all required fields are mapped");
    }

    const newSource: TSourceConnection = {
      id: crypto.randomUUID(),
      name: sourceName.trim(),
      type: selectedType,
      mappings,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    onCreateSource(newSource);
    resetForm();
    onOpenChange(false);
  };

  const requiredFields = FEEDBACK_RECORD_FIELDS.filter((f) => f.required);
  const allRequiredMapped = requiredFields.every((field) =>
    mappings.some((m) => m.targetFieldId === field.id && (m.sourceFieldId || m.staticValue))
  );

  // Formbricks validation - need survey and at least one question selected
  const isFormbricksValid =
    selectedType === "formbricks" && selectedSurveyId && selectedQuestionIds.length > 0;

  // CSV validation - need sourceFields loaded (CSV uploaded or sample loaded)
  const isCsvValid = selectedType === "csv" && sourceFields.length > 0;

  const handleLoadSourceFields = () => {
    if (!selectedType) return;
    let fields: TSourceField[];
    if (selectedType === "webhook") {
      fields = parsePayloadToFields(SAMPLE_WEBHOOK_PAYLOAD);
    } else if (selectedType === "email") {
      fields = EMAIL_SOURCE_FIELDS;
    } else if (selectedType === "csv") {
      fields = parseCSVColumnsToFields(SAMPLE_CSV_COLUMNS);
    } else {
      fields = parsePayloadToFields(SAMPLE_WEBHOOK_PAYLOAD);
    }
    setSourceFields(fields);
  };

  const handleSuggestMapping = () => {
    if (!selectedType) return;
    const suggestions = AI_SUGGESTED_MAPPINGS[selectedType];
    if (!suggestions) return;

    const newMappings: TFieldMapping[] = [];

    // Add field mappings from source fields
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

    // Add static value mappings
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

  const getLoadButtonLabel = () => {
    switch (selectedType) {
      case "webhook":
        return "Simulate webhook";
      case "email":
        return "Load email fields";
      case "csv":
        return "Load sample CSV";
      default:
        return "Load sample";
    }
  };

  return (
    <>
      <Button onClick={() => onOpenChange(true)} size="sm">
        Add source
        <PlusIcon className="ml-2 h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {currentStep === "selectType"
                ? "Add Feedback Source"
                : selectedType === "formbricks"
                  ? "Select Survey & Questions"
                  : selectedType === "csv"
                    ? "Import CSV Data"
                    : "Configure Mapping"}
            </DialogTitle>
            <DialogDescription>
              {currentStep === "selectType"
                ? "Select the type of feedback source you want to connect."
                : selectedType === "formbricks"
                  ? "Choose which survey questions should create FeedbackRecords."
                  : selectedType === "csv"
                    ? "Upload a CSV file or set up automated S3 imports."
                    : "Map source fields to Hub Feedback Record fields."}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {currentStep === "selectType" ? (
              <SourceTypeSelector selectedType={selectedType} onSelectType={setSelectedType} />
            ) : selectedType === "formbricks" ? (
              /* Formbricks Survey Selector UI */
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sourceName">Source Name</Label>
                  <Input
                    id="sourceName"
                    value={sourceName}
                    onChange={(e) => setSourceName(e.target.value)}
                    placeholder="Enter a name for this source"
                  />
                </div>

                <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <FormbricksSurveySelector
                    selectedSurveyId={selectedSurveyId}
                    selectedQuestionIds={selectedQuestionIds}
                    onSurveySelect={handleSurveySelect}
                    onQuestionToggle={handleQuestionToggle}
                    onSelectAllQuestions={handleSelectAllQuestions}
                    onDeselectAllQuestions={handleDeselectAllQuestions}
                  />
                </div>
              </div>
            ) : selectedType === "csv" ? (
              /* CSV Upload & S3 Integration UI */
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sourceName">Source Name</Label>
                  <Input
                    id="sourceName"
                    value={sourceName}
                    onChange={(e) => setSourceName(e.target.value)}
                    placeholder="Enter a name for this source"
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
              /* Other source types (webhook, email) - Mapping UI */
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sourceName">Source Name</Label>
                  <Input
                    id="sourceName"
                    value={sourceName}
                    onChange={(e) => setSourceName(e.target.value)}
                    placeholder="Enter a name for this source"
                  />
                </div>

                {/* Action buttons above scrollable area */}
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleLoadSourceFields}>
                      {getLoadButtonLabel()}
                    </Button>
                    {sourceFields.length > 0 && (
                      <Button variant="outline" size="sm" onClick={handleSuggestMapping} className="gap-2">
                        <SparklesIcon className="h-4 w-4 text-purple-500" />
                        Suggest mapping
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
                    deriveFromAttachments={deriveFromAttachments}
                    onDeriveFromAttachmentsChange={setDeriveFromAttachments}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            {currentStep === "mapping" && (
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
            )}
            {currentStep === "selectType" ? (
              <Button onClick={handleNextStep} disabled={!selectedType || selectedType === "slack"}>
                {selectedType === "formbricks"
                  ? "Select questions"
                  : selectedType === "csv"
                    ? "Configure import"
                    : "Create mapping"}
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
                Setup connection
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
