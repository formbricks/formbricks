"use client";

import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { type JSX, useState } from "react";
import { createId } from "@paralleldrive/cuid2";
import { CONTACT_FIELD_PRESETS } from "@formbricks/types/surveys/contact-field-presets";
import { TCustomField, TSurveyContactInfoElement } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { createI18nString, extractLanguageCodes } from "@/lib/i18n/utils";
import { ElementFormInput } from "@/modules/survey/components/element-form-input";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { Switch } from "@/modules/ui/components/switch";

const BUILTIN_IDS = ["firstName", "lastName", "email", "phone", "company"];
const BUILTIN_LABELS: Record<string, string> = {
  firstName: "First Name",
  lastName: "Last Name",
  email: "Email",
  phone: "Phone",
  company: "Company",
};

const CUSTOM_FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "url", label: "URL" },
  { value: "dropdown", label: "Dropdown" },
] as const;

interface CustomFieldsSectionProps {
  localSurvey: TSurvey;
  element: TSurveyContactInfoElement;
  elementIdx: number;
  updateElement: (elementIdx: number, updatedAttributes: Partial<TSurveyContactInfoElement>) => void;
  isInvalid: boolean;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (language: string) => void;
  locale: TUserLocale;
  isStorageConfigured: boolean;
}

export const CustomFieldsSection = ({
  localSurvey,
  element,
  elementIdx,
  updateElement,
  isInvalid,
  selectedLanguageCode,
  setSelectedLanguageCode,
  locale,
  isStorageConfigured,
}: CustomFieldsSectionProps): JSX.Element => {
  const surveyLanguageCodes = extractLanguageCodes(localSurvey.languages ?? []);
  const customFields = element.customFields ?? [];
  const [newOptionTexts, setNewOptionTexts] = useState<Record<string, string>>({});

  const updateCustomField = (fieldId: string, updates: Partial<TCustomField>) => {
    const updatedFields = customFields.map((cf) => (cf.id === fieldId ? { ...cf, ...updates } : cf));
    updateElement(elementIdx, { customFields: updatedFields });
  };

  const addCustomField = () => {
    if (customFields.length >= 10) return;
    const newField: TCustomField = {
      id: `cf_${createId()}`,
      label: "",
      type: "text",
      show: true,
      required: false,
      placeholder: createI18nString("", surveyLanguageCodes),
    };
    updateElement(elementIdx, {
      customFields: [...customFields, newField],
    });
  };

  const removeCustomField = (fieldId: string) => {
    const updatedFields = customFields.filter((cf) => cf.id !== fieldId);
    const updatedOrder = (element.fieldOrder ?? []).filter((id) => id !== fieldId);
    updateElement(elementIdx, {
      customFields: updatedFields,
      fieldOrder: updatedOrder.length > 0 ? updatedOrder : undefined,
    });
  };

  const applyPreset = (fieldId: string, presetId: string) => {
    const preset = CONTACT_FIELD_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const options = preset.options.map((opt) => ({
      id: createId(),
      label: createI18nString(opt, surveyLanguageCodes),
    }));
    updateCustomField(fieldId, { presetId, options });
  };

  const addOption = (fieldId: string, text: string) => {
    if (!text.trim()) return;
    const field = customFields.find((cf) => cf.id === fieldId);
    if (!field) return;
    const newOption = {
      id: createId(),
      label: createI18nString(text.trim(), surveyLanguageCodes),
    };
    updateCustomField(fieldId, {
      options: [...(field.options ?? []), newOption],
      presetId: undefined,
    });
    setNewOptionTexts((prev) => ({ ...prev, [fieldId]: "" }));
  };

  const removeOption = (fieldId: string, optionId: string) => {
    const field = customFields.find((cf) => cf.id === fieldId);
    if (!field) return;
    updateCustomField(fieldId, {
      options: (field.options ?? []).filter((o) => o.id !== optionId),
      presetId: undefined,
    });
  };

  // --- Field Order ---
  const getEffectiveFieldOrder = (): string[] => {
    if (element.fieldOrder) return element.fieldOrder;
    const builtInVisible = BUILTIN_IDS.filter((id) => {
      const config = element[id as keyof typeof element];
      return config && typeof config === "object" && "show" in config && (config as any).show;
    });
    const customVisible = customFields.filter((cf) => cf.show).map((cf) => cf.id);
    return [...builtInVisible, ...customVisible];
  };

  const getFieldLabel = (fieldId: string): string => {
    if (BUILTIN_LABELS[fieldId]) return BUILTIN_LABELS[fieldId];
    const cf = customFields.find((c) => c.id === fieldId);
    return cf?.label || fieldId;
  };

  const moveField = (index: number, direction: "up" | "down") => {
    const order = [...getEffectiveFieldOrder()];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= order.length) return;
    [order[index], order[newIndex]] = [order[newIndex], order[index]];
    updateElement(elementIdx, { fieldOrder: order });
  };

  const effectiveOrder = getEffectiveFieldOrder();
  const hasCustomFields = customFields.length > 0;

  return (
    <div className="mt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-800">CUSTOM FIELDS</h3>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {customFields.length}/10
          </span>
        </div>
        <Button
          size="sm"
          variant="secondary"
          type="button"
          onClick={addCustomField}
          disabled={customFields.length >= 10}>
          <PlusIcon className="mr-1 h-4 w-4" />
          Add Custom Field
        </Button>
      </div>

      {/* Custom Fields List */}
      {customFields.length > 0 && (
        <div className="mt-4 space-y-4">
          {customFields.map((field) => (
            <div key={field.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              {/* Row 1: Label, Type, Show, Required, Delete */}
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Input
                    value={field.label}
                    onChange={(e) => updateCustomField(field.id, { label: e.target.value })}
                    placeholder="Field name"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="w-32">
                  <Select
                    value={field.type}
                    onValueChange={(val) => {
                      const updates: Partial<TCustomField> = { type: val as TCustomField["type"] };
                      if (val !== "dropdown") {
                        updates.options = undefined;
                        updates.presetId = undefined;
                      }
                      updateCustomField(field.id, updates);
                    }}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CUSTOM_FIELD_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1">
                  <label className="text-xs text-slate-500">Show</label>
                  <Switch
                    checked={field.show}
                    onCheckedChange={(show) => updateCustomField(field.id, { show })}
                  />
                </div>
                <div className="flex items-center gap-1">
                  <label className="text-xs text-slate-500">Req</label>
                  <Switch
                    checked={field.required}
                    onCheckedChange={(required) => updateCustomField(field.id, { required })}
                    disabled={!field.show}
                  />
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  className="h-8 w-8 p-0 text-slate-400 hover:text-red-500"
                  onClick={() => removeCustomField(field.id)}>
                  <Trash2Icon className="h-4 w-4" />
                </Button>
              </div>

              {/* Row 2: Placeholder */}
              <div className="mt-2">
                <ElementFormInput
                  id={`${field.id}.placeholder`}
                  label=""
                  value={field.placeholder}
                  localSurvey={localSurvey}
                  elementIdx={elementIdx}
                  isInvalid={isInvalid}
                  updateElement={(_idx, attrs) => {
                    // ElementFormInput updates via element path like "cf_xxx.placeholder"
                    // We need to intercept and route to customFields update
                    const placeholderKey = `${field.id}.placeholder`;
                    if (placeholderKey in attrs) {
                      updateCustomField(field.id, {
                        placeholder: (attrs as any)[placeholderKey],
                      });
                    }
                  }}
                  selectedLanguageCode={selectedLanguageCode}
                  setSelectedLanguageCode={setSelectedLanguageCode}
                  locale={locale}
                  isStorageConfigured={isStorageConfigured}
                />
              </div>

              {/* Dropdown-specific: Preset selector + Options editor */}
              {field.type === "dropdown" && (
                <div className="mt-3 space-y-2">
                  {/* Preset selector */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-slate-600">Preset:</label>
                    <Select
                      value={field.presetId || "none"}
                      onValueChange={(val) => {
                        if (val === "none") {
                          updateCustomField(field.id, { presetId: undefined, options: [] });
                        } else {
                          applyPreset(field.id, val);
                        }
                      }}>
                      <SelectTrigger className="h-7 w-40 text-xs">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None (custom)</SelectItem>
                        {CONTACT_FIELD_PRESETS.map((preset) => (
                          <SelectItem key={preset.id} value={preset.id}>
                            {preset.label} ({preset.options.length})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Inline options */}
                  <div>
                    <label className="text-xs font-medium text-slate-600">Options:</label>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(field.options ?? []).map((opt) => (
                        <span
                          key={opt.id}
                          className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs text-slate-700 ring-1 ring-slate-200">
                          {opt.label.default || opt.label[selectedLanguageCode] || ""}
                          <button
                            type="button"
                            onClick={() => removeOption(field.id, opt.id)}
                            className="text-slate-400 hover:text-red-500">
                            <XIcon className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="mt-1 flex gap-1">
                      <Input
                        value={newOptionTexts[field.id] || ""}
                        onChange={(e) =>
                          setNewOptionTexts((prev) => ({ ...prev, [field.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addOption(field.id, newOptionTexts[field.id] || "");
                          }
                        }}
                        placeholder="Add option..."
                        className="h-7 text-xs"
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        type="button"
                        className="h-7 px-2 text-xs"
                        onClick={() => addOption(field.id, newOptionTexts[field.id] || "")}>
                        Add
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Field Order Section */}
      {hasCustomFields && (
        <div className="mt-6">
          <h4 className="text-sm font-semibold text-slate-800">FIELD ORDER</h4>
          <p className="mb-2 text-xs text-slate-500">
            Reorder how fields appear in the survey. Only visible fields are shown.
          </p>
          <div className="space-y-1">
            {effectiveOrder.map((fieldId, index) => (
              <div
                key={fieldId}
                className="flex items-center gap-2 rounded border border-slate-200 bg-white px-3 py-1.5 text-sm">
                <span className="flex-1 text-slate-700">{getFieldLabel(fieldId)}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  className="h-6 w-6 p-0"
                  disabled={index === 0}
                  onClick={() => moveField(index, "up")}>
                  <ArrowUpIcon className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  className="h-6 w-6 p-0"
                  disabled={index === effectiveOrder.length - 1}
                  onClick={() => moveField(index, "down")}>
                  <ArrowDownIcon className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
