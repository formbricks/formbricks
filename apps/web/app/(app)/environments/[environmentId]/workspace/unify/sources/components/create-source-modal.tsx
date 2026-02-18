"use client";

import { CheckIcon, CopyIcon, PlusIcon, SparklesIcon, WebhookIcon } from "lucide-react";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
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
  EMAIL_SOURCE_FIELDS,
  FEEDBACK_RECORD_FIELDS,
  SAMPLE_CSV_COLUMNS,
  SAMPLE_WEBHOOK_PAYLOAD,
  TCreateSourceStep,
  TFieldMapping,
  TSourceConnection,
  TSourceField,
  TSourceType,
  TUnifySurvey,
} from "../types";
import { parseCSVColumnsToFields, parsePayloadToFields } from "../utils";
import { CsvSourceUI } from "./csv-source-ui";
import { FormbricksSurveySelector } from "./formbricks-survey-selector";
import { MappingUI } from "./mapping-ui";
import { SourceTypeSelector } from "./source-type-selector";

// Polling interval in milliseconds (3 seconds)
const WEBHOOK_POLL_INTERVAL = 3000;

// Sample webhook payload for cURL example
const SAMPLE_CURL_PAYLOAD = {
  timestamp: new Date().toISOString(),
  source_type: "webhook",
  field_id: "satisfaction_score",
  field_type: "rating",
  value_number: 4,
  user_id: "user_123",
  metadata: {
    source: "api",
  },
};

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

export function CreateSourceModal({ open, onOpenChange, onCreateSource, surveys }: CreateSourceModalProps) {
  const [currentStep, setCurrentStep] = useState<TCreateSourceStep>("selectType");
  const [selectedType, setSelectedType] = useState<TSourceType | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [mappings, setMappings] = useState<TFieldMapping[]>([]);
  const [sourceFields, setSourceFields] = useState<TSourceField[]>([]);
  const [deriveFromAttachments, setDeriveFromAttachments] = useState(false);

  // Formbricks-specific state
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);

  // Webhook listener state
  const [webhookSessionId, setWebhookSessionId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [webhookReceived, setWebhookReceived] = useState(false);
  const [copied, setCopied] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Generate webhook URL
  const webhookUrl = webhookSessionId
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api/unify/webhook-listener/${webhookSessionId}`
    : "";

  // Poll for webhook payload
  const pollForWebhook = useCallback(async () => {
    if (!webhookSessionId) return;

    try {
      const response = await fetch(`/api/unify/webhook-listener/${webhookSessionId}`);

      if (response.status === 200) {
        const data = await response.json();
        if (data.payload) {
          // Parse the received payload into source fields
          const fields = parsePayloadToFields(data.payload);
          setSourceFields(fields);
          setWebhookReceived(true);
          setIsListening(false);
          toast.success("Webhook received! Fields loaded.");

          // Stop polling
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        }
      }
      // 204 means no payload yet, keep polling
    } catch (error) {
      console.error("Error polling for webhook:", error);
    }
  }, [webhookSessionId]);

  // Start/stop polling based on listening state
  useEffect(() => {
    if (isListening && webhookSessionId) {
      // Start polling
      pollingIntervalRef.current = setInterval(pollForWebhook, WEBHOOK_POLL_INTERVAL);
      // Also poll immediately
      pollForWebhook();
    }

    return () => {
      // Cleanup polling on unmount or when listening stops
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [isListening, webhookSessionId, pollForWebhook]);

  // Generate session ID when webhook type is selected and modal opens
  useEffect(() => {
    if (open && selectedType === "webhook" && currentStep === "mapping" && !webhookSessionId) {
      setWebhookSessionId(nanoid(21));
      setIsListening(true);
    }
  }, [open, selectedType, currentStep, webhookSessionId]);

  // Copy cURL command to clipboard
  const handleCopyWebhookUrl = async () => {
    if (!webhookUrl) return;
    const curlCommand = `curl -X POST \\
  "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(SAMPLE_CURL_PAYLOAD, null, 2)}'`;
    try {
      await navigator.clipboard.writeText(curlCommand);
      setCopied(true);
      toast.success("cURL command copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const resetForm = () => {
    setCurrentStep("selectType");
    setSelectedType(null);
    setSourceName("");
    setMappings([]);
    setSourceFields([]);
    setDeriveFromAttachments(false);
    setSelectedSurveyId(null);
    setSelectedElementIds([]);
    // Reset webhook state
    setWebhookSessionId(null);
    setIsListening(false);
    setWebhookReceived(false);
    setCopied(false);
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
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

  // Formbricks handlers
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

    // Check if all required fields are mapped (for non-Formbricks connectors)
    if (selectedType !== "formbricks") {
      const requiredFields = FEEDBACK_RECORD_FIELDS.filter((f) => f.required);
      const allRequiredMapped = requiredFields.every((field) =>
        mappings.some((m) => m.targetFieldId === field.id)
      );

      if (!allRequiredMapped) {
        // For now, we'll allow creating without all required fields for POC
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

    // Pass the Formbricks-specific data if applicable
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

  // Formbricks validation - need survey and at least one element selected
  const isFormbricksValid =
    selectedType === "formbricks" && selectedSurveyId && selectedElementIds.length > 0;

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

                {/* Webhook Listener UI */}
                {selectedType === "webhook" && !webhookReceived && (
                  <div className="space-y-6">
                    {/* Centered waiting indicator */}
                    <div className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50 py-12">
                      <span className="relative mb-4 flex h-16 w-16">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-slate-300 opacity-75"></span>
                        <span className="relative inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-200">
                          <WebhookIcon className="h-8 w-8 text-slate-600" />
                        </span>
                      </span>
                      <p className="text-lg font-medium text-slate-700">Waiting for webhook...</p>
                      <p className="mt-1 text-sm text-slate-500">Send a request to the URL below</p>
                    </div>

                    {/* cURL example at bottom */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">Test with cURL</Label>
                      <div className="relative">
                        <pre className="overflow-auto rounded-lg border border-slate-300 bg-slate-900 p-3 text-xs text-slate-100">
                          <code>{`curl -X POST "${webhookUrl || "..."}" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(SAMPLE_CURL_PAYLOAD, null, 2)}'`}</code>
                        </pre>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleCopyWebhookUrl}
                          disabled={!webhookUrl}
                          className="absolute right-2 top-2">
                          {copied ? (
                            <>
                              <CheckIcon className="mr-1 h-3 w-3" />
                              Copied
                            </>
                          ) : (
                            <>
                              <CopyIcon className="mr-1 h-3 w-3" />
                              Copy
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Webhook received - show success + mapping UI */}
                {selectedType === "webhook" && webhookReceived && (
                  <div className="space-y-4">
                    {/* Success indicator */}
                    <div className="flex flex-col items-center justify-center rounded-lg border border-green-200 bg-green-50 py-6">
                      <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-green-500">
                        <CheckIcon className="h-6 w-6 text-white" />
                      </div>
                      <p className="text-lg font-medium text-green-700">Webhook received!</p>
                      <p className="mt-1 text-sm text-green-600">
                        {sourceFields.length} fields detected. Map them below.
                      </p>
                    </div>

                    {/* AI suggest mapping button */}
                    {sourceFields.length > 0 && (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleSuggestMapping} className="gap-2">
                          <SparklesIcon className="h-4 w-4 text-purple-500" />
                          Suggest mapping
                          <Badge text="AI" type="gray" size="tiny" className="ml-1" />
                        </Button>
                      </div>
                    )}

                    {/* Mapping UI */}
                    <div className="max-h-[40vh] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <MappingUI
                        sourceFields={sourceFields}
                        mappings={mappings}
                        onMappingsChange={setMappings}
                        sourceType={selectedType}
                        deriveFromAttachments={deriveFromAttachments}
                        onDeriveFromAttachmentsChange={setDeriveFromAttachments}
                      />
                    </div>
                  </div>
                )}

                {/* Non-webhook types */}
                {selectedType !== "webhook" && (
                  <>
                    {/* Action buttons */}
                    <div className="flex items-center justify-between">
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleLoadSourceFields}>
                          {getLoadButtonLabel()}
                        </Button>
                        {sourceFields.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSuggestMapping}
                            className="gap-2">
                            <SparklesIcon className="h-4 w-4 text-purple-500" />
                            Suggest mapping
                            <Badge text="AI" type="gray" size="tiny" className="ml-1" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Mapping UI */}
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
                  </>
                )}
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
