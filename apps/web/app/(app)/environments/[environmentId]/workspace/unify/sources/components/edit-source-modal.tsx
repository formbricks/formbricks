"use client";

import {
  CheckIcon,
  CopyIcon,
  FileSpreadsheetIcon,
  GlobeIcon,
  MailIcon,
  MessageSquareIcon,
  SparklesIcon,
  WebhookIcon,
} from "lucide-react";
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
  TFieldMapping,
  TSourceConnection,
  TSourceField,
  TSourceType,
  TUnifySurvey,
} from "../types";
import { parseCSVColumnsToFields, parsePayloadToFields } from "../utils";
import { FormbricksSurveySelector } from "./formbricks-survey-selector";
import { MappingUI } from "./mapping-ui";

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

interface EditSourceModalProps {
  source: TSourceConnection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateSource: (
    source: TSourceConnection,
    selectedSurveyId?: string,
    selectedElementIds?: string[]
  ) => void;
  onDeleteSource: (sourceId: string) => void;
  surveys: TUnifySurvey[];
  // For Formbricks connectors - the currently selected survey/elements
  initialSurveyId?: string | null;
  initialElementIds?: string[];
}

function getSourceIcon(type: TSourceType) {
  switch (type) {
    case "formbricks":
      return <GlobeIcon className="h-5 w-5 text-slate-500" />;
    case "webhook":
      return <WebhookIcon className="h-5 w-5 text-slate-500" />;
    case "email":
      return <MailIcon className="h-5 w-5 text-slate-500" />;
    case "csv":
      return <FileSpreadsheetIcon className="h-5 w-5 text-slate-500" />;
    case "slack":
      return <MessageSquareIcon className="h-5 w-5 text-slate-500" />;
    default:
      return <GlobeIcon className="h-5 w-5 text-slate-500" />;
  }
}

function getSourceTypeLabel(type: TSourceType) {
  switch (type) {
    case "formbricks":
      return "Formbricks Surveys";
    case "webhook":
      return "Webhook";
    case "email":
      return "Email";
    case "csv":
      return "CSV Import";
    case "slack":
      return "Slack Message";
    default:
      return type;
  }
}

function getInitialSourceFields(type: TSourceType): TSourceField[] {
  switch (type) {
    case "webhook":
      return parsePayloadToFields(SAMPLE_WEBHOOK_PAYLOAD);
    case "email":
      return EMAIL_SOURCE_FIELDS;
    case "csv":
      return parseCSVColumnsToFields(SAMPLE_CSV_COLUMNS);
    default:
      return [];
  }
}

export function EditSourceModal({
  source,
  open,
  onOpenChange,
  onUpdateSource,
  onDeleteSource,
  surveys,
  initialSurveyId,
  initialElementIds = [],
}: EditSourceModalProps) {
  const [sourceName, setSourceName] = useState("");
  const [mappings, setMappings] = useState<TFieldMapping[]>([]);
  const [sourceFields, setSourceFields] = useState<TSourceField[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deriveFromAttachments, setDeriveFromAttachments] = useState(false);

  // Formbricks-specific state
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);

  // Webhook listener state
  const [isListening, setIsListening] = useState(false);
  const [webhookReceived, setWebhookReceived] = useState(false);
  const [copied, setCopied] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Permanent webhook URL using connector ID
  const webhookUrl = source
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api/unify/webhook/${source.id}`
    : "";

  // Poll for webhook payload using connector ID
  const pollForWebhook = useCallback(async () => {
    if (!source?.id) return;

    try {
      const response = await fetch(`/api/unify/webhook/${source.id}`);

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
  }, [source?.id]);

  // Start/stop polling based on listening state
  useEffect(() => {
    if (isListening && source?.id) {
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
  }, [isListening, source?.id, pollForWebhook]);

  // Copy webhook URL to clipboard
  const handleCopyWebhookUrl = async () => {
    if (!webhookUrl) return;
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      toast.success("Webhook URL copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  useEffect(() => {
    if (source) {
      setSourceName(source.name);
      setMappings(source.mappings);
      setDeriveFromAttachments(false);

      // For Formbricks connectors, set the initial survey/element selection
      if (source.type === "formbricks") {
        setSelectedSurveyId(initialSurveyId ?? null);
        setSelectedElementIds(initialElementIds);
        setSourceFields(getInitialSourceFields(source.type));
      } else if (source.type === "webhook") {
        // Webhook: if we already have mappings, show them; otherwise show listening state
        if (source.mappings.length > 0) {
          // Build source fields from existing mapping source IDs so the mapping UI can display them
          const sourceFieldIds = new Set<string>();
          for (const m of source.mappings) {
            if (m.sourceFieldId) sourceFieldIds.add(m.sourceFieldId);
          }
          const fieldsFromMappings = Array.from(sourceFieldIds).map((id) => ({
            id,
            name: id,
            type: "string",
            sampleValue: "",
          }));
          setSourceFields(fieldsFromMappings);
          setWebhookReceived(true);
          setIsListening(false);
        } else {
          setSourceFields([]);
          setIsListening(true);
          setWebhookReceived(false);
        }
      } else {
        setSourceFields(getInitialSourceFields(source.type));
      }
    }
  }, [source, initialSurveyId, initialElementIds]);

  const resetForm = () => {
    setSourceName("");
    setMappings([]);
    setSourceFields([]);
    setShowDeleteConfirm(false);
    setDeriveFromAttachments(false);
    setSelectedSurveyId(null);
    setSelectedElementIds([]);
    // Reset webhook state
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

  const handleUpdateSource = () => {
    if (!source || !sourceName.trim()) return;

    const updatedSource: TSourceConnection = {
      ...source,
      name: sourceName.trim(),
      mappings,
      updatedAt: new Date(),
    };

    // For Formbricks, pass the survey/element selection
    if (source.type === "formbricks") {
      onUpdateSource(updatedSource, selectedSurveyId ?? undefined, selectedElementIds);
    } else {
      onUpdateSource(updatedSource);
    }
    handleOpenChange(false);
  };

  const handleDeleteSource = () => {
    if (!source) return;
    onDeleteSource(source.id);
    handleOpenChange(false);
  };

  const handleLoadSourceFields = () => {
    if (!source) return;
    let fields: TSourceField[];
    if (source.type === "webhook") {
      fields = parsePayloadToFields(SAMPLE_WEBHOOK_PAYLOAD);
    } else if (source.type === "email") {
      fields = EMAIL_SOURCE_FIELDS;
    } else if (source.type === "csv") {
      fields = parseCSVColumnsToFields(SAMPLE_CSV_COLUMNS);
    } else {
      fields = parsePayloadToFields(SAMPLE_WEBHOOK_PAYLOAD);
    }
    setSourceFields(fields);
  };

  const handleSuggestMapping = () => {
    if (!source) return;
    const suggestions = AI_SUGGESTED_MAPPINGS[source.type];
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

  const getLoadButtonLabel = () => {
    switch (source?.type) {
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

  if (!source) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit Source Connection</DialogTitle>
          <DialogDescription>Update the mapping configuration for this source.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Source Type Display */}
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            {getSourceIcon(source.type)}
            <div>
              <p className="text-sm font-medium text-slate-900">{getSourceTypeLabel(source.type)}</p>
              <p className="text-xs text-slate-500">Source type cannot be changed</p>
            </div>
          </div>

          {/* Source Name */}
          <div className="space-y-2">
            <Label htmlFor="editSourceName">Source Name</Label>
            <Input
              id="editSourceName"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder="Enter a name for this source"
            />
          </div>

          {source.type === "formbricks" ? (
            /* Formbricks Survey Selector UI */
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
            /* Other source types - Mapping UI */
            <>
              {/* Webhook Listener UI - Waiting state */}
              {source.type === "webhook" && !webhookReceived && (
                <div className="space-y-4">
                  {/* Permanent Webhook URL */}
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100">
                        <WebhookIcon className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-900">Your Webhook URL</p>
                        <p className="mt-0.5 text-xs text-blue-700">
                          This is your permanent webhook endpoint. Use it in your integrations.
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <code className="flex-1 rounded bg-white px-2 py-1 text-xs text-blue-800">
                            {webhookUrl || "Loading..."}
                          </code>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCopyWebhookUrl}
                            disabled={!webhookUrl}
                            className="shrink-0 border-blue-300 text-blue-700 hover:bg-blue-100">
                            {copied ? <CheckIcon className="h-3 w-3" /> : <CopyIcon className="h-3 w-3" />}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Centered waiting indicator */}
                  <div className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50 py-8">
                    <span className="relative mb-3 flex h-12 w-12">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-slate-300 opacity-75"></span>
                      <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-200">
                        <WebhookIcon className="h-6 w-6 text-slate-600" />
                      </span>
                    </span>
                    <p className="text-sm font-medium text-slate-700">Listening for test payload...</p>
                    <p className="mt-1 text-xs text-slate-500">Send a request to update field mappings</p>
                  </div>

                  {/* cURL example */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">Test with cURL</Label>
                    <div className="relative">
                      <pre className="overflow-auto rounded-lg border border-slate-300 bg-slate-900 p-3 text-xs text-slate-100">
                        <code>{`curl -X POST "${webhookUrl || "..."}" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(SAMPLE_CURL_PAYLOAD, null, 2)}'`}</code>
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {/* Webhook configured - show mapping UI */}
              {source.type === "webhook" && webhookReceived && (
                <div className="space-y-4">
                  {/* Webhook URL + copy (when already configured) */}
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <span className="text-xs font-medium text-slate-600">Webhook URL:</span>
                    <code className="min-w-0 flex-1 truncate text-xs text-slate-700">
                      {webhookUrl || "..."}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyWebhookUrl}
                      disabled={!webhookUrl}
                      className="h-7 shrink-0 px-2">
                      {copied ? <CheckIcon className="h-3 w-3" /> : <CopyIcon className="h-3 w-3" />}
                    </Button>
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
                      sourceType={source.type}
                      deriveFromAttachments={deriveFromAttachments}
                      onDeriveFromAttachmentsChange={setDeriveFromAttachments}
                    />
                  </div>
                </div>
              )}

              {/* Non-webhook types */}
              {source.type !== "webhook" && (
                <>
                  {/* Action buttons */}
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

                  {/* Mapping UI */}
                  <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <MappingUI
                      sourceFields={sourceFields}
                      mappings={mappings}
                      onMappingsChange={setMappings}
                      sourceType={source.type}
                      deriveFromAttachments={deriveFromAttachments}
                      onDeriveFromAttachmentsChange={setDeriveFromAttachments}
                    />
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <div>
            {showDeleteConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-600">Are you sure?</span>
                <Button variant="destructive" size="sm" onClick={handleDeleteSource}>
                  Yes, delete
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={() => setShowDeleteConfirm(true)}>
                Delete source
              </Button>
            )}
          </div>
          <Button
            onClick={handleUpdateSource}
            disabled={
              !sourceName.trim() ||
              (source.type === "formbricks" && (!selectedSurveyId || selectedElementIds.length === 0))
            }>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
