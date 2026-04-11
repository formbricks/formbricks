# Contact Info Custom Fields

**Date:** 2026-04-10
**Status:** Approved

## Overview

Add support for user-defined custom fields on Contact Info questions. Survey creators can add up to 10 custom fields with various types (text, number, date, email, phone, url, dropdown), reorder all fields freely, and use preset lists for common dropdowns.

## Data Model

### New Types

```typescript
ZCustomFieldOption = z.object({
  id: z.string(),
  label: ZI18nString,
});

ZCustomField = z.object({
  id: z.string(),                    // unique identifier, e.g. "cf_abc123"
  label: z.string(),                 // field name shown in editor, e.g. "Title"
  type: z.enum(["text", "number", "date", "email", "phone", "url", "dropdown"]),
  show: z.boolean(),
  required: z.boolean(),
  placeholder: ZI18nString,
  prefillFrom: z.string().optional(),
  options: z.array(ZCustomFieldOption).optional(),  // only for dropdown type
  presetId: z.string().optional(),                  // references a preset list
});
```

### Schema Changes

`ZSurveyContactInfoElement` gets three new properties:

```typescript
customFields: z.array(ZCustomField).max(10).default([]),
fieldOrder: z.array(z.string()).optional(),
// If fieldOrder is absent, default order: built-ins then custom fields
```

Built-in fields (`firstName`, `lastName`, `email`, `phone`, `company`) remain as named properties. Custom fields live in the `customFields` array. The `fieldOrder` array controls display order of all fields.

### Response Data Format

Responses switch from array to object format:

```typescript
// Old format (backward compat - read only):
["John", "Doe", "john@example.com", "555-1234", "Acme Corp"]

// New format (read + write):
{
  firstName: "John",
  lastName: "Doe",
  email: "john@example.com",
  phone: "555-1234",
  company: "Acme Corp",
  cf_abc123: "Dr.",
  cf_def456: "III"
}
```

A shared normalizer function handles both formats for backward compatibility:

```typescript
function normalizeContactInfoResponse(value: unknown): Record<string, string> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, string>;
  }
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

## Preset Lists System

Preset lists live in `packages/types/surveys/contact-field-presets.ts`:

```typescript
interface ContactFieldPreset {
  id: string;        // e.g. "title"
  label: string;     // e.g. "Title"
  options: string[]; // e.g. ["Mr.", "Mrs.", "Ms.", "Dr.", "Prof."]
}

export const CONTACT_FIELD_PRESETS: ContactFieldPreset[] = [
  { id: "title", label: "Title", options: ["Mr.", "Mrs.", "Ms.", "Dr.", "Prof.", "Rev."] },
  { id: "suffix", label: "Suffix", options: ["Jr.", "Sr.", "II", "III", "IV", "Esq.", "Ph.D.", "M.D."] },
  { id: "us-states", label: "US States", options: [/* all 50 + DC + territories */] },
  { id: "countries", label: "Countries", options: [/* ISO 3166 list */] },
];
```

When a dropdown field uses a preset (`presetId: "title"`), options are populated from the preset. If the user modifies the options (adds, removes, or reorders), `presetId` is cleared and the `options` array becomes fully user-managed. Adding new presets means adding entries to this array. A future admin UI could read/write from the same data structure.

## Editor UI

### Existing Toggle Table (unchanged)

The `ElementToggleTable` component continues to render the 5 built-in fields with show/required/placeholder/prefill controls.

### New Custom Fields Section

A new `CustomFieldsSection` component renders below the toggle table at `apps/web/modules/survey/editor/components/custom-fields-section.tsx`.

Structure:
- **Header**: "CUSTOM FIELDS" label + "+ Add Custom Field" button + count badge ("2/10")
- **Each custom field row**:
  - Drag handle for reordering
  - Field name input
  - Type dropdown (text, number, date, email, phone, url, dropdown)
  - When type is "dropdown": preset selector or inline options editor
  - Show toggle, Required toggle, Placeholder input
  - Delete button (trash icon)
- **"Add Custom Field" button**: adds inline form with name input + type selector, defaults to "text"

### Field Order Control

When custom fields exist, a draggable list appears showing all visible fields (built-in + custom) in their current order. Drag-to-reorder updates the `fieldOrder` array.

## Survey Renderer

The `ContactInfoElement` component changes:

- **Field iteration**: Reads `fieldOrder` (falling back to `["firstName", "lastName", "email", "phone", "company"]` if absent) and iterates in that order.
- **Built-in field resolution**: For IDs like `"firstName"`, reads from `element.firstName` as today.
- **Custom field resolution**: For IDs like `"cf_abc123"`, looks up in `element.customFields` by ID.
- **Field rendering**:
  - Text/number/date/email/phone/url: render as `<input>` with appropriate `type` via existing `FormField` component
  - Dropdown: render using existing `SingleSelect` component with `variant: "dropdown"` from `packages/survey-ui`
- **Response data**: Always writes object format. Reads both array and object formats.

The `FormField` component in `packages/survey-ui` needs a small extension to support a `"select"` field type, passing options through to `SingleSelect`.

## Backward Compatibility

### Response Reading

Every consumer of contact info response data uses the `normalizeContactInfoResponse` utility:

- `RenderResponse.tsx` — response card rendering
- `surveySummary.ts` — summary samples extraction
- `transform.ts`, `generate-html.ts`, `generate-docx.ts` — survey exports
- `compound-prefill.ts` — prefill resolution
- CSV/Excel export — custom fields become additional columns named by label
- `surveys.ts` — filter logic ("Filled out" / "Skipped" unchanged)

### Schema Compatibility

- `fieldOrder` is optional — absent means default built-in order
- `customFields` defaults to empty array
- Existing surveys with no custom fields work identically

### Compound Fields Constants

`CONTACT_INFO_FIELDS` and `ALL_COMPOUND_FIELD_INDICES` in `compound-fields.ts` remain for built-in fields. The index-based lookup becomes secondary to object-key-based access. `getCompoundFields()` continues to return the built-in field list.

## Validation

### Editor Validation (`validation.ts`)

- `handleI18nCheckForContactAndAddressFields` extends to iterate `element.customFields` for i18n placeholder validation
- "At least one field visible" check includes custom fields

### Schema Validation (`types.ts`)

- Both legacy question and block element validation extend the "at least one visible field" check to include custom fields

### Custom Field Validation

- Field `id` must be unique within the element
- Field `label` must be non-empty
- Dropdown fields must have at least one option (preset or user-defined)
- Max 10 custom fields (schema-enforced)
- `fieldOrder` must contain exactly the IDs of all visible fields; strip references to missing/hidden fields; append visible fields missing from the order

### Logic Rules (`logic-rule-engine.ts`)

Contact info keeps `isSubmitted` / `isSkipped` operators only. No change.

## Follow-ups & Email

The follow-up system continues to use the built-in `email` field as the "send to" source. Custom fields of type `email` are not added as follow-up targets. No changes needed to `follow-up-modal.tsx`, `follow-up-item.tsx`, or `preview-email-template.tsx`.

## Files Modified

### New Files
- `packages/types/surveys/contact-field-presets.ts` — preset list definitions
- `apps/web/modules/survey/editor/components/custom-fields-section.tsx` — editor UI for custom fields

### Modified Files
- `packages/types/surveys/elements.ts` — add `ZCustomField`, `ZCustomFieldOption`, extend `ZSurveyContactInfoElement`
- `packages/types/surveys/types.ts` — update deprecated `ZSurveyContactInfoQuestion` to match, update validation
- `packages/types/surveys/compound-fields.ts` — add `normalizeContactInfoResponse`, update field handling
- `packages/surveys/src/components/elements/contact-info-element.tsx` — dynamic field iteration, object response format
- `packages/surveys/src/lib/compound-prefill.ts` — handle object response format
- `packages/survey-ui/src/components/elements/form-field.stories.tsx` — extend FormField for select type
- `apps/web/modules/survey/editor/components/contact-info-element-form.tsx` — import and render CustomFieldsSection
- `apps/web/modules/survey/editor/lib/validation.ts` — extend i18n and visibility checks
- `apps/web/modules/survey/lib/elements.tsx` — update element preset
- `apps/web/modules/analysis/components/SingleResponseCard/components/RenderResponse.tsx` — use normalizer
- `apps/web/app/(app)/.../surveySummary.ts` — use normalizer
- `apps/web/app/(app)/.../survey-export/transform.ts` — handle custom fields in export
- `apps/web/app/(app)/.../survey-export/generate-html.ts` — render custom fields
- `apps/web/app/(app)/.../survey-export/generate-docx.ts` — render custom fields
- `apps/web/app/lib/surveys/surveys.ts` — filter compatibility

## Out of Scope

- Admin UI for preset list management (future enhancement)
- Custom fields on Address question type (separate effort)
- New logic operators for custom fields
- Custom email fields as follow-up targets
- Data migration for existing array-format responses (they continue to work via normalizer)
