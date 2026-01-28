"use client";

import {
  FileSpreadsheetIcon,
  GlobeIcon,
  MailIcon,
  MessageSquareIcon,
  SparklesIcon,
  WebhookIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
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
import { MappingUI } from "./mapping-ui";
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
  parseCSVColumnsToFields,
  parsePayloadToFields,
} from "./types";

interface EditSourceModalProps {
  source: TSourceConnection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateSource: (source: TSourceConnection) => void;
  onDeleteSource: (sourceId: string) => void;
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
}: EditSourceModalProps) {
  const [sourceName, setSourceName] = useState("");
  const [mappings, setMappings] = useState<TFieldMapping[]>([]);
  const [sourceFields, setSourceFields] = useState<TSourceField[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deriveFromAttachments, setDeriveFromAttachments] = useState(false);

  useEffect(() => {
    if (source) {
      setSourceName(source.name);
      setMappings(source.mappings);
      setSourceFields(getInitialSourceFields(source.type));
      setDeriveFromAttachments(false);
    }
  }, [source]);

  const resetForm = () => {
    setSourceName("");
    setMappings([]);
    setSourceFields([]);
    setShowDeleteConfirm(false);
    setDeriveFromAttachments(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const handleUpdateSource = () => {
    if (!source || !sourceName.trim()) return;

    const updatedSource: TSourceConnection = {
      ...source,
      name: sourceName.trim(),
      mappings,
      updatedAt: new Date(),
    };

    onUpdateSource(updatedSource);
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
          <Button onClick={handleUpdateSource} disabled={!sourceName.trim()}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
