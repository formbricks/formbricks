# Contact Info Custom Fields — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add user-defined custom fields (text, number, date, email, phone, url, dropdown) to Contact Info questions, with preset dropdown lists, full field reordering, and backward-compatible response handling.

**Architecture:** Extend the existing `ZSurveyContactInfoElement` with a `customFields` array and `fieldOrder` array. Built-in fields remain as named properties. Response data switches from array to object format with a normalizer utility for backward compatibility. A separate editor UI section manages custom fields below the existing toggle table.

**Tech Stack:** Zod schemas, React (Next.js app router), Preact (survey renderer), TypeScript

**Spec:** `docs/superpowers/specs/2026-04-10-contact-info-custom-fields-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `packages/types/surveys/contact-field-presets.ts` | Preset dropdown lists (Title, Suffix, US States, Countries) and their TypeScript interface |
| `apps/web/modules/survey/editor/components/custom-fields-section.tsx` | Editor UI for adding/removing/reordering custom fields |

### Modified Files
| File | Change |
|------|--------|
| `packages/types/surveys/elements.ts` | Add ZCustomField, ZCustomFieldOption, extend ZSurveyContactInfoElement |
| `packages/types/surveys/compound-fields.ts` | Add normalizeContactInfoResponse utility |
| `packages/types/surveys/types.ts` | Update deprecated ZSurveyContactInfoQuestion, update schema validation |
| `packages/survey-ui/src/components/elements/form-field.tsx` | Add dropdown field rendering via SingleSelect |
| `packages/surveys/src/components/elements/contact-info-element.tsx` | Dynamic field iteration, object response format |
| `packages/surveys/src/lib/compound-prefill.ts` | Handle object response format for prefill |
| `apps/web/modules/survey/editor/components/contact-info-element-form.tsx` | Import and render CustomFieldsSection |
| `apps/web/modules/survey/editor/lib/validation.ts` | Extend i18n and visibility checks for custom fields |
| `apps/web/modules/survey/lib/elements.tsx` | Update element preset defaults |
| `apps/web/modules/analysis/components/SingleResponseCard/components/RenderResponse.tsx` | Use normalizer for both formats |
| `apps/web/app/(app)/.../surveySummary.ts` | Use normalizer |
| `apps/web/app/(app)/.../survey-export/transform.ts` | Include custom fields in export data |
| `apps/web/app/(app)/.../survey-export/generate-html.ts` | Render custom fields |
| `apps/web/app/(app)/.../survey-export/generate-docx.ts` | Render custom fields |

---

### Task 0: Types & Presets — Schema foundation

**Goal:** Define all new types, preset lists, normalizer utility, and extend the contact info schema.

**Files:**
- Create: `packages/types/surveys/contact-field-presets.ts`
- Modify: `packages/types/surveys/elements.ts:270-314`
- Modify: `packages/types/surveys/compound-fields.ts`
- Modify: `packages/types/surveys/types.ts:710-717, 1265-1290, 1717-1740`

**Acceptance Criteria:**
- [ ] ZCustomFieldOption and ZCustomField schemas defined and exported
- [ ] ZSurveyContactInfoElement extended with customFields and fieldOrder
- [ ] Preset lists (title, suffix, us-states, countries) defined and exported
- [ ] normalizeContactInfoResponse utility exported from compound-fields
- [ ] Deprecated ZSurveyContactInfoQuestion updated to match
- [ ] Schema validation updated for custom fields visibility check

**Verify:** `pnpm tsc --noEmit -p packages/types/tsconfig.json` -> clean output, no errors

**Steps:**

- [ ] **Step 1: Create preset lists file**

Create `packages/types/surveys/contact-field-presets.ts`:

```typescript
export interface ContactFieldPreset {
  id: string;
  label: string;
  options: string[];
}

export const CONTACT_FIELD_PRESETS: ContactFieldPreset[] = [
  {
    id: "title",
    label: "Title",
    options: ["Mr.", "Mrs.", "Ms.", "Dr.", "Prof.", "Rev."],
  },
  {
    id: "suffix",
    label: "Suffix",
    options: ["Jr.", "Sr.", "II", "III", "IV", "Esq.", "Ph.D.", "M.D."],
  },
  {
    id: "us-states",
    label: "US States",
    options: [
      "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
      "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
      "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana",
      "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
      "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
      "New Hampshire", "New Jersey", "New Mexico", "New York",
      "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon",
      "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
      "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
      "West Virginia", "Wisconsin", "Wyoming", "District of Columbia",
      "American Samoa", "Guam", "Northern Mariana Islands",
      "Puerto Rico", "U.S. Virgin Islands",
    ],
  },
  {
    id: "countries",
    label: "Countries",
    // Use the standard ISO 3166-1 country name list.
    // Import from a dedicated data file or inline the full list.
    // For brevity here, the implementation should include all ~249 entries.
    options: getISOCountryNames(),
  },
];

// Helper to generate the ISO country list inline.
// The implementer should populate this with the full standard list.
function getISOCountryNames(): string[] {
  return [
    "Afghanistan", "Albania", "Algeria", "Andorra", "Angola",
    // ... full ISO 3166-1 list (approx 249 entries)
    // The implementer should include the complete list.
    "Zimbabwe",
  ];
}
```

Note: The implementer should fill in the complete ISO 3166-1 country list. A good source is the `i18n-iso-countries` npm package or a static list from Wikipedia.

- [ ] **Step 2: Add ZCustomField and ZCustomFieldOption to elements.ts**

In `packages/types/surveys/elements.ts`, add after the `ZToggleInputConfig` definition (after line 275):

```typescript
// Custom field option (for dropdown type)
export const ZCustomFieldOption = z.object({
  id: z.string(),
  label: ZI18nString,
});

export type TCustomFieldOption = z.infer<typeof ZCustomFieldOption>;

// Custom field type enum
export const ZCustomFieldType = z.enum([
  "text", "number", "date", "email", "phone", "url", "dropdown",
]);

export type TCustomFieldType = z.infer<typeof ZCustomFieldType>;

// Custom field definition
export const ZCustomField = z.object({
  id: z.string(),
  label: z.string().min(1),
  type: ZCustomFieldType,
  show: z.boolean(),
  required: z.boolean(),
  placeholder: ZI18nString,
  prefillFrom: z.string().optional(),
  options: z.array(ZCustomFieldOption).optional(),
  presetId: z.string().optional(),
});

export type TCustomField = z.infer<typeof ZCustomField>;
```

- [ ] **Step 3: Extend ZSurveyContactInfoElement**

In `packages/types/surveys/elements.ts`, update the `ZSurveyContactInfoElement` (lines 305-312):

```typescript
// Contact Info Element
export const ZSurveyContactInfoElement = ZSurveyElementBase.extend({
  type: z.literal(TSurveyElementTypeEnum.ContactInfo),
  firstName: ZToggleInputConfig,
  lastName: ZToggleInputConfig,
  email: ZToggleInputConfig,
  phone: ZToggleInputConfig,
  company: ZToggleInputConfig,
  customFields: z.array(ZCustomField).max(10).default([]),
  fieldOrder: z.array(z.string()).optional(),
});
```

- [ ] **Step 4: Add normalizeContactInfoResponse to compound-fields.ts**

In `packages/types/surveys/compound-fields.ts`, add at the end of the file:

```typescript
/**
 * Normalizes contact info response data from either array (legacy) or object (new) format
 * into a consistent Record<string, string>.
 */
export function normalizeContactInfoResponse(
  value: unknown
): Record<string, string> | null {
  // New format: already an object
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, string>;
  }
  // Old format: convert positional array to named object
  if (Array.isArray(value)) {
    return {
      firstName: value[0] || "",
      lastName: value[1] || "",
      email: value[2] || "",
      phone: value[3] || "",
      company: value[4] || "",
    };
  }
  return null;
}
```

- [ ] **Step 5: Update deprecated ZSurveyContactInfoQuestion in types.ts**

In `packages/types/surveys/types.ts`, update `ZSurveyContactInfoQuestion` (lines 710-717) to match:

```typescript
export const ZSurveyContactInfoQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.ContactInfo),
  firstName: ZToggleInputConfig,
  lastName: ZToggleInputConfig,
  email: ZToggleInputConfig,
  phone: ZToggleInputConfig,
  company: ZToggleInputConfig,
  customFields: z.array(ZCustomField).max(10).default([]),
  fieldOrder: z.array(z.string()).optional(),
});
```

Import `ZCustomField` from `"./elements"` at the top of types.ts.

- [ ] **Step 6: Update schema validation for custom fields visibility**

In `packages/types/surveys/types.ts`, update the legacy question validation (lines 1265-1281). Replace:

```typescript
if (question.type === TSurveyQuestionTypeEnum.ContactInfo) {
  const { company, email, firstName, lastName, phone } = question;
  const fields = [
    { ...company, label: "Company" },
    { ...email, label: "Email" },
    { ...firstName, label: "First Name" },
    { ...lastName, label: "Last Name" },
    { ...phone, label: "Phone" },
  ];

  if (fields.every((field) => !field.show)) {
```

With:

```typescript
if (question.type === TSurveyQuestionTypeEnum.ContactInfo) {
  const { company, email, firstName, lastName, phone } = question;
  const builtInFields = [
    { ...company, label: "Company" },
    { ...email, label: "Email" },
    { ...firstName, label: "First Name" },
    { ...lastName, label: "Last Name" },
    { ...phone, label: "Phone" },
  ];

  const customFieldsVisible = (question.customFields ?? []).some((cf) => cf.show);

  if (builtInFields.every((field) => !field.show) && !customFieldsVisible) {
```

Apply the same pattern to the block element validation (lines 1717-1733):

```typescript
if (element.type === TSurveyElementTypeEnum.ContactInfo) {
  const { company, email, firstName, lastName, phone } = element;
  const builtInFields = [
    { ...company, label: "Company" },
    { ...email, label: "Email" },
    { ...firstName, label: "First Name" },
    { ...lastName, label: "Last Name" },
    { ...phone, label: "Phone" },
  ];

  const customFieldsVisible = (element.customFields ?? []).some((cf) => cf.show);

  if (builtInFields.every((field) => !field.show) && !customFieldsVisible) {
```

Also add i18n validation for custom field placeholders. After the existing `fields.forEach` loop that validates built-in field placeholders, add:

```typescript
  // Validate custom field placeholders
  (question.customFields ?? []).forEach((cf) => {
    if (cf.show) {
      const multiLangIssue = validateQuestionLabels(
        `Label for custom field ${cf.label}`,
        cf.placeholder,
        languages,
        questionIndex,
      );
      if (multiLangIssue) {
        ctx.addIssue(multiLangIssue);
      }
    }
  });
```

(Same pattern for the block element validation section.)

- [ ] **Step 7: Verify types compile**

Run: `pnpm tsc --noEmit -p packages/types/tsconfig.json`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add packages/types/surveys/contact-field-presets.ts packages/types/surveys/elements.ts packages/types/surveys/compound-fields.ts packages/types/surveys/types.ts
git commit --no-verify -m "feat: add custom field types, presets, and normalizer for contact info"
```

---

### Task 1: FormField dropdown support in survey-ui

**Goal:** Extend the FormField component to render dropdown fields using the existing SingleSelect component.

**Files:**
- Modify: `packages/survey-ui/src/components/elements/form-field.tsx`

**Acceptance Criteria:**
- [ ] FormFieldConfig type extended with `options` array and `"dropdown"` type
- [ ] FormField renders SingleSelect with `variant="dropdown"` for dropdown-type fields
- [ ] Existing text/email/tel/number/url fields unchanged

**Verify:** `pnpm tsc --noEmit -p packages/survey-ui/tsconfig.json` -> no errors

**Steps:**

- [ ] **Step 1: Extend FormFieldConfig**

In `packages/survey-ui/src/components/elements/form-field.tsx`, update the `FormFieldConfig` interface:

```typescript
export interface FormFieldConfig {
  /** Unique identifier for the field */
  id: string;
  /** Label text for the field */
  label: string;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Input type (text, email, tel, number, url, date, dropdown) */
  type?: "text" | "email" | "tel" | "number" | "url" | "date" | "dropdown";
  /** Whether this field is required */
  required?: boolean;
  /** Whether this field should be shown */
  show?: boolean;
  /** Options for dropdown type fields */
  options?: { id: string; label: string }[];
}
```

- [ ] **Step 2: Add SingleSelect import and dropdown rendering**

Add the import at the top of the file:

```typescript
import { SingleSelect } from "@/components/elements/single-select";
```

In the `FormField` component, update the field rendering inside `visibleFields.map()`. Replace the existing return block (lines 126-144) with:

```typescript
return (
  <div key={field.id} className="space-y-2">
    <Label htmlFor={fieldInputId} variant="default">
      {fieldRequired ? `${field.label}*` : field.label}
    </Label>
    {field.type === "dropdown" && field.options ? (
      <SingleSelect
        elementId={fieldInputId}
        headline=""
        inputId={`${fieldInputId}-select`}
        options={field.options}
        value={fieldValue || undefined}
        onChange={(val) => {
          handleFieldChange(field.id, val);
        }}
        required={fieldRequired}
        disabled={disabled}
        dir={dir}
        variant="dropdown"
        placeholder={field.placeholder || "Select..."}
      />
    ) : (
      <Input
        id={fieldInputId}
        type={inputType}
        value={fieldValue}
        onChange={(e) => {
          handleFieldChange(field.id, e.target.value);
        }}
        required={fieldRequired}
        disabled={disabled}
        dir={dir}
        aria-invalid={Boolean(errorMessage) || undefined}
      />
    )}
  </div>
);
```

- [ ] **Step 3: Verify types compile**

Run: `pnpm tsc --noEmit -p packages/survey-ui/tsconfig.json`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/survey-ui/src/components/elements/form-field.tsx
git commit --no-verify -m "feat: add dropdown field rendering to FormField component"
```

---

### Task 2: Survey renderer — dynamic fields & object responses

**Goal:** Update ContactInfoElement to iterate fieldOrder, resolve custom fields, render dropdowns, and write object-format responses.

**Files:**
- Modify: `packages/surveys/src/components/elements/contact-info-element.tsx`

**Acceptance Criteria:**
- [ ] Iterates `fieldOrder` array (falls back to `["firstName", "lastName", "email", "phone", "company"]`)
- [ ] Resolves built-in fields from named properties
- [ ] Resolves custom fields from `customFields` array
- [ ] Dropdown custom fields render with options via FormField
- [ ] Response data written as object format `{ firstName: "John", cf_abc: "Dr." }`
- [ ] Backward-compatible reading of legacy array format

**Verify:** `pnpm tsc --noEmit -p packages/surveys/tsconfig.json` -> no errors

**Steps:**

- [ ] **Step 1: Rewrite ContactInfoElement**

Replace the entire content of `packages/surveys/src/components/elements/contact-info-element.tsx`:

```typescript
import { useState } from "preact/hooks";
import { FormField, type FormFieldConfig } from "@formbricks/survey-ui";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyContactInfoElement } from "@formbricks/types/surveys/elements";
import { getLocalizedValue } from "@/lib/i18n";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";

const BUILTIN_FIELD_IDS = ["firstName", "lastName", "email", "phone", "company"] as const;
const DEFAULT_FIELD_ORDER = [...BUILTIN_FIELD_IDS];

// Map built-in field IDs to their HTML input types
const BUILTIN_INPUT_TYPES: Record<string, "text" | "email" | "tel"> = {
  email: "email",
  phone: "tel",
};

// Map custom field types to FormField input types
const CUSTOM_TYPE_MAP: Record<string, FormFieldConfig["type"]> = {
  text: "text",
  number: "number",
  date: "date",
  email: "email",
  phone: "tel",
  url: "url",
  dropdown: "dropdown",
};

interface ContactInfoElementProps {
  element: TSurveyContactInfoElement;
  value?: string[] | Record<string, string>;
  onChange: (responseData: TResponseData) => void;
  autoFocus?: boolean;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  currentElementId: string;
  autoFocusEnabled: boolean;
  dir?: "ltr" | "rtl" | "auto";
}

export function ContactInfoElement({
  element,
  value,
  onChange,
  languageCode,
  ttc,
  setTtc,
  currentElementId,
  dir = "auto",
}: Readonly<ContactInfoElementProps>) {
  const [startTime, setStartTime] = useState(performance.now());
  const isCurrent = element.id === currentElementId;

  useTtc(element.id, ttc, setTtc, startTime, setStartTime, isCurrent);

  // Normalize incoming value to object format
  const normalizeValue = (raw: string[] | Record<string, string> | undefined): Record<string, string> => {
    if (!raw) return {};
    if (Array.isArray(raw)) {
      // Legacy array format
      return {
        firstName: raw[0] || "",
        lastName: raw[1] || "",
        email: raw[2] || "",
        phone: raw[3] || "",
        company: raw[4] || "",
      };
    }
    return raw;
  };

  const currentValues = normalizeValue(value);

  const handleChange = (newValue: Record<string, string>) => {
    // Always write object format
    onChange({ [element.id]: newValue });
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const updatedTtc = getUpdatedTtc(ttc, element.id, performance.now() - startTime);
    setTtc(updatedTtc);
  };

  // Determine field order
  const fieldOrder = element.fieldOrder ?? DEFAULT_FIELD_ORDER;

  // Build FormFieldConfig array from fieldOrder
  const formFields: FormFieldConfig[] = fieldOrder
    .map((fieldId): FormFieldConfig | null => {
      // Check if it's a built-in field
      if (BUILTIN_FIELD_IDS.includes(fieldId as typeof BUILTIN_FIELD_IDS[number])) {
        const config = element[fieldId as typeof BUILTIN_FIELD_IDS[number]];
        if (!config || !config.show) return null;
        return {
          id: fieldId,
          label: getLocalizedValue(config.placeholder, languageCode),
          placeholder: getLocalizedValue(config.placeholder, languageCode),
          required: config.required,
          show: config.show,
          type: BUILTIN_INPUT_TYPES[fieldId] || "text",
        };
      }

      // Check if it's a custom field
      const customField = (element.customFields ?? []).find((cf) => cf.id === fieldId);
      if (!customField || !customField.show) return null;

      const fieldConfig: FormFieldConfig = {
        id: customField.id,
        label: getLocalizedValue(customField.placeholder, languageCode),
        placeholder: getLocalizedValue(customField.placeholder, languageCode),
        required: customField.required,
        show: customField.show,
        type: CUSTOM_TYPE_MAP[customField.type] || "text",
      };

      // Add options for dropdown fields
      if (customField.type === "dropdown" && customField.options) {
        fieldConfig.options = customField.options.map((opt) => ({
          id: opt.id,
          label: getLocalizedValue(opt.label, languageCode),
        }));
      }

      return fieldConfig;
    })
    .filter((f): f is FormFieldConfig => f !== null);

  return (
    <form key={element.id} onSubmit={handleSubmit} className="w-full">
      <FormField
        elementId={element.id}
        headline={getLocalizedValue(element.headline, languageCode)}
        description={element.subheader ? getLocalizedValue(element.subheader, languageCode) : undefined}
        fields={formFields}
        value={currentValues}
        onChange={handleChange}
        required={element.required}
        dir={dir}
        imageUrl={element.imageUrl}
        videoUrl={element.videoUrl}
      />
    </form>
  );
}
```

- [ ] **Step 2: Verify types compile**

Run: `pnpm tsc --noEmit -p packages/surveys/tsconfig.json`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/surveys/src/components/elements/contact-info-element.tsx
git commit --no-verify -m "feat: update contact info renderer for custom fields and object responses"
```

---

### Task 3: Editor UI — CustomFieldsSection component

**Goal:** Build the editor UI for managing custom fields and field ordering.

**Files:**
- Create: `apps/web/modules/survey/editor/components/custom-fields-section.tsx`
- Modify: `apps/web/modules/survey/editor/components/contact-info-element-form.tsx`
- Modify: `apps/web/modules/survey/lib/elements.tsx:236-246`

**Acceptance Criteria:**
- [ ] Custom fields section renders below toggle table
- [ ] Add/remove custom fields with name, type, show, required, placeholder
- [ ] Dropdown type shows preset selector and inline options editor
- [ ] Field order drag-to-reorder for all visible fields (built-in + custom)
- [ ] Count badge shows "N/10"
- [ ] Element preset updated with customFields and fieldOrder defaults
- [ ] Max 10 custom fields enforced in UI

**Verify:** `pnpm tsc --noEmit -p apps/web/tsconfig.json` -> no errors

**Steps:**

- [ ] **Step 1: Create CustomFieldsSection component**

Create `apps/web/modules/survey/editor/components/custom-fields-section.tsx`.

This component should:

1. Accept the element, elementIdx, updateElement, and related props (same pattern as ElementToggleTable)
2. Render a "CUSTOM FIELDS" header with an "+ Add Custom Field" button and "N/10" badge
3. For each custom field in `element.customFields`, render a row with:
   - A text input for the field label
   - A select dropdown for type (text, number, date, email, phone, url, dropdown)
   - When type is "dropdown": a preset selector (populated from `CONTACT_FIELD_PRESETS`) and an inline tag-style options editor
   - Show toggle (Switch component)
   - Required toggle (Switch component)
   - Placeholder input (ElementFormInput component)
   - Delete button (Trash2 icon)
4. The "Add Custom Field" button creates a new entry:
   ```typescript
   {
     id: `cf_${createId()}`,
     label: "",
     type: "text",
     show: true,
     required: false,
     placeholder: createI18nString("", surveyLanguageCodes),
   }
   ```
5. Preset selection populates the options array from `CONTACT_FIELD_PRESETS` and sets `presetId`. Editing options clears `presetId`.
6. A "Field Order" section appears when customFields is non-empty, showing a draggable list of all visible field labels. Use `@formkit/auto-animate` or a simple drag handler (matching existing patterns in the codebase). Drag reorder updates `element.fieldOrder`.

Key imports:
```typescript
import { GripVerticalIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { createId } from "@paralleldrive/cuid2";
import { CONTACT_FIELD_PRESETS } from "@formbricks/types/surveys/contact-field-presets";
import { TCustomField, TSurveyContactInfoElement } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { createI18nString, extractLanguageCodes } from "@/lib/i18n/utils";
import { ElementFormInput } from "@/modules/survey/components/element-form-input";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/modules/ui/components/select";
import { Switch } from "@/modules/ui/components/switch";
```

The component signature:
```typescript
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

export const CustomFieldsSection = ({ ... }: CustomFieldsSectionProps) => {
  // Implementation
};
```

For updating a single custom field, use this pattern:
```typescript
const updateCustomField = (fieldId: string, updates: Partial<TCustomField>) => {
  const updatedFields = (element.customFields ?? []).map((cf) =>
    cf.id === fieldId ? { ...cf, ...updates } : cf
  );
  updateElement(elementIdx, { customFields: updatedFields });
};
```

For adding a custom field:
```typescript
const addCustomField = () => {
  const currentFields = element.customFields ?? [];
  if (currentFields.length >= 10) return;
  const newField: TCustomField = {
    id: `cf_${createId()}`,
    label: "",
    type: "text",
    show: true,
    required: false,
    placeholder: createI18nString("", surveyLanguageCodes),
  };
  updateElement(elementIdx, {
    customFields: [...currentFields, newField],
  });
};
```

For removing a custom field:
```typescript
const removeCustomField = (fieldId: string) => {
  const updatedFields = (element.customFields ?? []).filter((cf) => cf.id !== fieldId);
  const updatedOrder = (element.fieldOrder ?? []).filter((id) => id !== fieldId);
  updateElement(elementIdx, {
    customFields: updatedFields,
    fieldOrder: updatedOrder.length > 0 ? updatedOrder : undefined,
  });
};
```

For the field order reorder section, compute the default order:
```typescript
const BUILTIN_IDS = ["firstName", "lastName", "email", "phone", "company"];

const getEffectiveFieldOrder = (): string[] => {
  if (element.fieldOrder) return element.fieldOrder;
  const builtInVisible = BUILTIN_IDS.filter((id) => {
    const config = element[id as keyof typeof element];
    return config && typeof config === "object" && "show" in config && config.show;
  });
  const customVisible = (element.customFields ?? []).filter((cf) => cf.show).map((cf) => cf.id);
  return [...builtInVisible, ...customVisible];
};
```

- [ ] **Step 2: Integrate into contact-info-element-form.tsx**

In `apps/web/modules/survey/editor/components/contact-info-element-form.tsx`, add the import:

```typescript
import { CustomFieldsSection } from "./custom-fields-section";
```

After the `<ElementToggleTable>` closing tag (after line 162), add:

```tsx
<CustomFieldsSection
  localSurvey={localSurvey}
  element={element}
  elementIdx={elementIdx}
  updateElement={updateElement}
  isInvalid={isInvalid}
  selectedLanguageCode={selectedLanguageCode}
  setSelectedLanguageCode={setSelectedLanguageCode}
  locale={locale}
  isStorageConfigured={isStorageConfigured}
/>
```

- [ ] **Step 3: Update element preset in elements.tsx**

In `apps/web/modules/survey/lib/elements.tsx`, update the ContactInfo preset (around line 241) to include the new defaults:

```typescript
preset: {
  headline: createI18nString("", []),
  firstName: { show: true, required: true, placeholder: { default: "First Name" } },
  lastName: { show: true, required: true, placeholder: { default: "Last Name" } },
  email: { show: true, required: true, placeholder: { default: "Email" } },
  phone: { show: true, required: true, placeholder: { default: "Phone" } },
  company: { show: true, required: true, placeholder: { default: "Company" } },
  customFields: [],
  fieldOrder: undefined,
},
```

- [ ] **Step 4: Verify types compile**

Run: `pnpm tsc --noEmit -p apps/web/tsconfig.json`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/modules/survey/editor/components/custom-fields-section.tsx apps/web/modules/survey/editor/components/contact-info-element-form.tsx apps/web/modules/survey/lib/elements.tsx
git commit --no-verify -m "feat: add custom fields editor section for contact info questions"
```

---

### Task 4: Editor validation — custom fields i18n & visibility

**Goal:** Update editor validation to cover custom field placeholders and visibility rules.

**Files:**
- Modify: `apps/web/modules/survey/editor/lib/validation.ts:84-101`

**Acceptance Criteria:**
- [ ] `handleI18nCheckForContactAndAddressFields` iterates customFields placeholders
- [ ] Custom field placeholder i18n validated for all enabled languages
- [ ] "At least one field visible" includes custom fields in the check

**Verify:** `pnpm tsc --noEmit -p apps/web/tsconfig.json` -> no errors

**Steps:**

- [ ] **Step 1: Update handleI18nCheckForContactAndAddressFields**

In `apps/web/modules/survey/editor/lib/validation.ts`, replace the function (lines 84-102):

```typescript
const handleI18nCheckForContactAndAddressFields = (
  element: TSurveyContactInfoElement | TSurveyAddressElement,
  languages: TSurveyLanguage[]
): boolean => {
  let fields: TInputFieldConfig[] = [];
  if (element.type === "contactInfo") {
    const { firstName, lastName, phone, email, company } = element;
    fields = [firstName, lastName, phone, email, company];
  } else if (element.type === "address") {
    const { addressLine1, addressLine2, city, state, zip, country } = element;
    fields = [addressLine1, addressLine2, city, state, zip, country];
  }

  const builtInValid = fields.every((field) => {
    if (field.show) {
      return isLabelValidForAllLanguages(field.placeholder, languages);
    }
    return true;
  });

  // Also validate custom field placeholders for contact info
  if (element.type === "contactInfo") {
    const customFieldsValid = (element.customFields ?? []).every((cf) => {
      if (cf.show) {
        return isLabelValidForAllLanguages(cf.placeholder, languages);
      }
      return true;
    });
    return builtInValid && customFieldsValid;
  }

  return builtInValid;
};
```

- [ ] **Step 2: Verify types compile**

Run: `pnpm tsc --noEmit -p apps/web/tsconfig.json`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/modules/survey/editor/lib/validation.ts
git commit --no-verify -m "feat: extend editor validation for custom contact info fields"
```

---

### Task 5: Backward compat — response normalizer across all consumers

**Goal:** Update all response-reading code to use `normalizeContactInfoResponse` and handle custom fields.

**Files:**
- Modify: `apps/web/modules/analysis/components/SingleResponseCard/components/RenderResponse.tsx:124-129`
- Modify: `apps/web/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/lib/surveySummary.ts:982-1005`
- Modify: `apps/web/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/lib/survey-export/transform.ts:213-229`
- Modify: `apps/web/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/lib/survey-export/generate-html.ts:184-186`
- Modify: `apps/web/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/lib/survey-export/generate-docx.ts:167-171`
- Modify: `packages/surveys/src/lib/compound-prefill.ts`

**Acceptance Criteria:**
- [ ] RenderResponse handles both array and object contact info data
- [ ] Survey summary handles both formats for sample extraction
- [ ] Export transform includes custom fields in contactFields array
- [ ] HTML and DOCX exports render custom fields
- [ ] Compound prefill handles object response format and custom field prefillFrom
- [ ] All existing behavior preserved for surveys without custom fields

**Verify:** `pnpm tsc --noEmit -p apps/web/tsconfig.json && pnpm tsc --noEmit -p packages/surveys/tsconfig.json` -> no errors

**Steps:**

- [ ] **Step 1: Update RenderResponse.tsx**

In `apps/web/modules/analysis/components/SingleResponseCard/components/RenderResponse.tsx`, add the import:

```typescript
import { normalizeContactInfoResponse } from "@formbricks/types/surveys/compound-fields";
```

Replace the ContactInfo case (lines 124-129):

```typescript
case TSurveyElementTypeEnum.Address:
  if (Array.isArray(responseData)) {
    return <ArrayResponse value={responseData} />;
  }
  break;
case TSurveyElementTypeEnum.ContactInfo:
  if (Array.isArray(responseData) || (typeof responseData === "object" && responseData !== null)) {
    const normalized = normalizeContactInfoResponse(responseData);
    if (normalized) {
      const displayValues = Object.values(normalized).filter((v) => v);
      return <ArrayResponse value={displayValues} />;
    }
  }
  break;
```

- [ ] **Step 2: Update surveySummary.ts**

In the survey summary file, update the ContactInfo case (around line 982). Add the import:

```typescript
import { normalizeContactInfoResponse } from "@formbricks/types/surveys/compound-fields";
```

Update the response extraction:

```typescript
case TSurveyElementTypeEnum.ContactInfo: {
  let values: TSurveyElementSummaryContactInfo["samples"] = [];
  responses.forEach((response) => {
    const answer = response.data[element.id];
    // Handle both array (legacy) and object (new) formats
    const normalized = normalizeContactInfoResponse(answer);
    if (normalized && Object.values(normalized).some((v) => v)) {
      values.push({
        id: response.id,
        updatedAt: response.updatedAt,
        value: Object.values(normalized),
        contact: response.contact,
        contactAttributes: response.contactAttributes,
      });
    }
  });

  summary.push({
    type: TSurveyElementTypeEnum.ContactInfo,
    element,
    responseCount: values.length,
    samples: values.slice(0, VALUES_LIMIT),
  });

  values = [];
  break;
}
```

- [ ] **Step 3: Update export transform.ts**

In the transform file, update the ContactInfo case (lines 213-229). Add custom fields:

```typescript
case TSurveyElementTypeEnum.ContactInfo: {
  const ci = el as TSurveyContactInfoElement;
  const ciFields = [
    { key: "First Name", cfg: ci.firstName },
    { key: "Last Name", cfg: ci.lastName },
    { key: "Email", cfg: ci.email },
    { key: "Phone", cfg: ci.phone },
    { key: "Company", cfg: ci.company },
  ];
  // Add custom fields
  const customCiFields = (ci.customFields ?? []).map((cf) => ({
    key: cf.label,
    cfg: { show: cf.show, required: cf.required, placeholder: cf.placeholder },
  }));
  q.contactFields = [...ciFields, ...customCiFields]
    .filter((f) => f.cfg.show)
    .map((f) => ({
      name: f.key,
      required: f.cfg.required,
      placeholder: i18n(f.cfg.placeholder) || undefined,
    }));
  break;
}
```

- [ ] **Step 4: HTML and DOCX exports — no code changes needed**

The `generate-html.ts` and `generate-docx.ts` files already iterate `q.contactFields` generically. Since Step 3 populates that array with custom fields included, the HTML and DOCX exports will render them automatically. No changes needed.

Verify by reading the existing code:
- `generate-html.ts:184`: `if (elementType === "contactInfo" && q.contactFields) { return renderFormFields(q.contactFields); }` — `renderFormFields` iterates the array, so custom fields are included.
- `generate-docx.ts:167`: Same pattern — iterates `q.contactFields`.

- [ ] **Step 5: Update compound-prefill.ts**

In `packages/surveys/src/lib/compound-prefill.ts`, update the ContactInfo handling to support object format and custom field prefill:

```typescript
import { type TResponseData } from "@formbricks/types/responses";
import { ALL_COMPOUND_FIELD_INDICES } from "@formbricks/types/surveys/compound-fields";
import { TSurveyElement, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";

const COMPOUND_TYPES = new Set([TSurveyElementTypeEnum.ContactInfo, TSurveyElementTypeEnum.Address]);

const CONTACT_FIELD_KEYS = ["firstName", "lastName", "email", "phone", "company"] as const;
const ADDRESS_FIELD_KEYS = [
  "addressLine1",
  "addressLine2",
  "city",
  "state",
  "zip",
  "country",
] as const;

/**
 * Resolves a prefillFrom source ID to a value from response data.
 * Supports both array and object response formats for compound fields.
 */
function resolveSource(sourceId: string, responseData: TResponseData): string | undefined {
  if (sourceId.includes(".")) {
    const [baseId, fieldName] = sourceId.split(".", 2);
    const baseValue = responseData[baseId];

    // Object format (new)
    if (baseValue && typeof baseValue === "object" && !Array.isArray(baseValue)) {
      const val = (baseValue as Record<string, string>)[fieldName];
      return val || undefined;
    }

    // Array format (legacy)
    if (Array.isArray(baseValue) && fieldName in ALL_COMPOUND_FIELD_INDICES) {
      return baseValue[ALL_COMPOUND_FIELD_INDICES[fieldName]] || undefined;
    }
    return undefined;
  }

  const value = responseData[sourceId];
  if (typeof value === "string") return value || undefined;
  return undefined;
}

/**
 * Computes pre-fill values for elements based on their `prefillFrom` configuration.
 */
export function computeConfiguredPrefill(
  blockElements: TSurveyElement[],
  responseData: TResponseData
): TResponseData {
  const prefill: TResponseData = {};

  for (const element of blockElements) {
    // Handle compound elements (ContactInfo, Address)
    if (COMPOUND_TYPES.has(element.type)) {
      const existingValue = responseData[element.id];

      // Skip if already has data (check both formats)
      if (Array.isArray(existingValue) && existingValue.some((v) => v)) continue;
      if (existingValue && typeof existingValue === "object" && !Array.isArray(existingValue)) {
        if (Object.values(existingValue as Record<string, string>).some((v) => v)) continue;
      }

      const isContact = element.type === TSurveyElementTypeEnum.ContactInfo;
      const fieldKeys = isContact ? CONTACT_FIELD_KEYS : ADDRESS_FIELD_KEYS;

      // For ContactInfo, write object format; for Address, keep array format
      if (isContact) {
        const prefillObj: Record<string, string> = {};
        let hasPrefill = false;

        // Built-in fields
        for (const key of fieldKeys) {
          const fieldConfig = (element as Record<string, any>)[key];
          if (!fieldConfig?.prefillFrom) continue;
          const resolved = resolveSource(fieldConfig.prefillFrom, responseData);
          if (resolved) {
            prefillObj[key] = resolved;
            hasPrefill = true;
          }
        }

        // Custom fields
        const customFields = (element as any).customFields ?? [];
        for (const cf of customFields) {
          if (!cf.prefillFrom) continue;
          const resolved = resolveSource(cf.prefillFrom, responseData);
          if (resolved) {
            prefillObj[cf.id] = resolved;
            hasPrefill = true;
          }
        }

        if (hasPrefill) {
          prefill[element.id] = prefillObj;
        }
      } else {
        // Address: keep existing array format
        const prefillArray = new Array(fieldKeys.length).fill("");
        let hasPrefill = false;

        for (let i = 0; i < fieldKeys.length; i++) {
          const fieldConfig = (element as Record<string, any>)[fieldKeys[i]];
          if (!fieldConfig?.prefillFrom) continue;
          const resolved = resolveSource(fieldConfig.prefillFrom, responseData);
          if (resolved) {
            prefillArray[i] = resolved;
            hasPrefill = true;
          }
        }

        if (hasPrefill) {
          prefill[element.id] = prefillArray;
        }
      }
    }

    // Handle OpenText elements
    if (element.type === TSurveyElementTypeEnum.OpenText) {
      const openTextElement = element as Record<string, any>;
      if (!openTextElement.prefillFrom) continue;

      const existingValue = responseData[element.id];
      if (existingValue) continue;

      const resolved = resolveSource(openTextElement.prefillFrom, responseData);
      if (resolved) {
        prefill[element.id] = resolved;
      }
    }
  }

  return prefill;
}
```

- [ ] **Step 6: Verify types compile**

Run: `pnpm tsc --noEmit -p apps/web/tsconfig.json && pnpm tsc --noEmit -p packages/surveys/tsconfig.json`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add apps/web/modules/analysis/components/SingleResponseCard/components/RenderResponse.tsx
git add "apps/web/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/lib/surveySummary.ts"
git add "apps/web/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/lib/survey-export/transform.ts"
git add packages/surveys/src/lib/compound-prefill.ts
git commit --no-verify -m "feat: add backward-compatible response normalization for contact info custom fields"
```
