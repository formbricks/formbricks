"use client";

import { DndContext, DragEndEvent, DragOverlay, DragStartEvent } from "@dnd-kit/core";
import { CopyIcon, MailIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/modules/ui/components/badge";
import { Switch } from "@/modules/ui/components/switch";
import { FEEDBACK_RECORD_FIELDS, TFieldMapping, TSourceField, TSourceType } from "../types";
import { DraggableSourceField, DroppableTargetField } from "./mapping-field";

interface MappingUIProps {
  sourceFields: TSourceField[];
  mappings: TFieldMapping[];
  onMappingsChange: (mappings: TFieldMapping[]) => void;
  sourceType: TSourceType;
  deriveFromAttachments?: boolean;
  onDeriveFromAttachmentsChange?: (value: boolean) => void;
  emailInboxId?: string;
}

export function MappingUI({
  sourceFields,
  mappings,
  onMappingsChange,
  sourceType,
  deriveFromAttachments = false,
  onDeriveFromAttachmentsChange,
  emailInboxId,
}: MappingUIProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [emailCopied, setEmailCopied] = useState(false);

  // Generate a stable random email ID if not provided
  const generatedEmailId = useMemo(() => {
    if (emailInboxId) return emailInboxId;
    return `fb-${Math.random().toString(36).substring(2, 8)}`;
  }, [emailInboxId]);

  const inboxEmail = `${generatedEmailId}@inbox.formbricks.com`;

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(inboxEmail);
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 2000);
  };

  const requiredFields = FEEDBACK_RECORD_FIELDS.filter((f) => f.required);
  const optionalFields = FEEDBACK_RECORD_FIELDS.filter((f) => !f.required);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const sourceFieldId = active.id as string;
    const targetFieldId = over.id as string;

    // Check if this target already has a mapping
    const existingMapping = mappings.find((m) => m.targetFieldId === targetFieldId);
    if (existingMapping) {
      // Remove the existing mapping first
      const newMappings = mappings.filter((m) => m.targetFieldId !== targetFieldId);
      onMappingsChange([...newMappings, { sourceFieldId, targetFieldId }]);
    } else {
      // Remove any existing mapping for this source field
      const newMappings = mappings.filter((m) => m.sourceFieldId !== sourceFieldId);
      onMappingsChange([...newMappings, { sourceFieldId, targetFieldId }]);
    }
  };

  const handleRemoveMapping = (targetFieldId: string) => {
    onMappingsChange(mappings.filter((m) => m.targetFieldId !== targetFieldId));
  };

  const handleStaticValueChange = (targetFieldId: string, staticValue: string) => {
    // Remove any existing mapping for this target field
    const newMappings = mappings.filter((m) => m.targetFieldId !== targetFieldId);
    // Add new static value mapping
    onMappingsChange([...newMappings, { targetFieldId, staticValue }]);
  };

  const getSourceFieldById = (id: string) => sourceFields.find((f) => f.id === id);
  const getMappingForTarget = (targetFieldId: string) => {
    return mappings.find((m) => m.targetFieldId === targetFieldId) ?? null;
  };
  const getMappedSourceField = (targetFieldId: string) => {
    const mapping = getMappingForTarget(targetFieldId);
    return mapping?.sourceFieldId ? getSourceFieldById(mapping.sourceFieldId) : null;
  };
  const isSourceFieldMapped = (sourceFieldId: string) =>
    mappings.some((m) => m.sourceFieldId === sourceFieldId);

  const activeField = activeId ? getSourceFieldById(activeId) : null;

  const getSourceTypeLabel = () => {
    switch (sourceType) {
      case "webhook":
        return "Webhook Payload";
      case "email":
        return "Email Fields";
      case "csv":
        return "CSV Columns";
      default:
        return "Source Fields";
    }
  };

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {/* Email inbox address display */}
      {sourceType === "email" && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
              <MailIcon className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-900">Your feedback inbox</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Forward emails to this address to capture feedback automatically
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="rounded bg-white px-2 py-1 font-mono text-sm text-blue-700">
                  {inboxEmail}
                </code>
                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-100">
                  <CopyIcon className="h-3 w-3" />
                  {emailCopied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Source Fields Panel */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-slate-700">{getSourceTypeLabel()}</h4>

          {sourceFields.length === 0 ? (
            <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
              <p className="text-sm text-slate-500">
                {sourceType === "webhook"
                  ? "Click 'Simulate webhook' to load sample fields"
                  : sourceType === "email"
                    ? "Click 'Load email fields' to see available fields"
                    : sourceType === "csv"
                      ? "Click 'Load sample CSV' to see columns"
                      : "No source fields loaded yet"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sourceFields.map((field) => (
                <DraggableSourceField key={field.id} field={field} isMapped={isSourceFieldMapped(field.id)} />
              ))}
            </div>
          )}

          {/* Email-specific options */}
          {sourceType === "email" && onDeriveFromAttachmentsChange && (
            <div className="mt-4 flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">Derive context from attachments</span>
                  <Badge text="AI" type="gray" size="tiny" />
                </div>
                <span className="text-xs text-slate-500">
                  Extract additional context from email attachments using AI
                </span>
              </div>
              <Switch checked={deriveFromAttachments} onCheckedChange={onDeriveFromAttachmentsChange} />
            </div>
          )}
        </div>

        {/* Target Fields Panel */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-slate-700">Hub Feedback Record Fields</h4>

          {/* Required Fields */}
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Required</p>
            {requiredFields.map((field) => (
              <DroppableTargetField
                key={field.id}
                field={field}
                mappedSourceField={getMappedSourceField(field.id) ?? null}
                mapping={getMappingForTarget(field.id)}
                onRemoveMapping={() => handleRemoveMapping(field.id)}
                onStaticValueChange={(value) => handleStaticValueChange(field.id, value)}
              />
            ))}
          </div>

          {/* Optional Fields */}
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Optional</p>
            {optionalFields.map((field) => (
              <DroppableTargetField
                key={field.id}
                field={field}
                mappedSourceField={getMappedSourceField(field.id) ?? null}
                mapping={getMappingForTarget(field.id)}
                onRemoveMapping={() => handleRemoveMapping(field.id)}
                onStaticValueChange={(value) => handleStaticValueChange(field.id, value)}
              />
            ))}
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeField ? (
          <div className="border-brand-dark rounded-md border bg-white p-2 text-sm shadow-lg">
            <span className="font-medium">{activeField.name}</span>
            <span className="ml-2 text-xs text-slate-500">({activeField.type})</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
