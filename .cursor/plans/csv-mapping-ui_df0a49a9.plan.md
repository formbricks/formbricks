---
name: csv-mapping-ui
overview: "Simplify the unreleased CSV mapping flow by matching the Formbricks Survey connector’s default-heavy behavior: hide predefined/internal fields, auto-map likely CSV columns, and present only the fields users need to review."
todos:
  - id: define-csv-field-model
    content: Define CSV-specific mapping groups, hidden static fields, required UI fields, aliases, and confidence metadata.
    status: pending
  - id: build-auto-mapping
    content: Implement auto-mapping from CSV headers, sample values, and filename, including `$now`, `csv`, and response-value routing.
    status: pending
  - id: refactor-mapping-ui
    content: Render grouped CSV mapping UI with Basic, Source Context, and collapsed Advanced sections while removing Tenant ID.
    status: pending
  - id: update-validation-transform
    content: Align create/edit validation and import transform with required `field_label`, hidden `source_type`, and synthetic `response_value`.
    status: pending
  - id: add-utility-tests
    content: Add Vitest coverage for auto-mapping, hidden/static mappings, filename defaults, and response-value routing.
    status: pending
isProject: false
---

# CSV Mapping UI Plan

## Current Comparison

- Formbricks Survey connector in [`/Users/johannes/Developer/formbricks/formbricks/apps/web/app/(app)/workspaces/[workspaceId]/unify/sources/components/create-connector-modal.tsx`](</Users/johannes/Developer/formbricks/formbricks/apps/web/app/(app)/workspaces/[workspaceId]/unify/sources/components/create-connector-modal.tsx>) prepopulates `sourceName`, selects all supported survey questions after survey selection, defaults `importHistorical` to true, and derives Hub `field_type` server-side via [`/Users/johannes/Developer/formbricks/formbricks/apps/web/lib/connector/actions.ts`](/Users/johannes/Developer/formbricks/formbricks/apps/web/lib/connector/actions.ts).
- CSV currently only defaults connector name and directory; it exposes all `FEEDBACK_RECORD_FIELDS`, including `tenant_id`, through [`MappingUI`](</Users/johannes/Developer/formbricks/formbricks/apps/web/app/(app)/workspaces/[workspaceId]/unify/sources/components/mapping-ui.tsx>).
- CSV import already backfills missing `tenant_id` from `connector.feedbackRecordDirectoryId` in [`/Users/johannes/Developer/formbricks/formbricks/apps/web/lib/connector/csv-import.ts`](/Users/johannes/Developer/formbricks/formbricks/apps/web/lib/connector/csv-import.ts) and [`/Users/johannes/Developer/formbricks/formbricks/apps/web/lib/connector/csv-transform.ts`](/Users/johannes/Developer/formbricks/formbricks/apps/web/lib/connector/csv-transform.ts), so the UI should not ask for it.

## Proposed UI Shape

- Keep a single CSV configuration screen: source name, upload/dropzone, preview, then mapping review. No additional wizard step.
- Replace the raw required/optional target list with grouped sections:
  - Basic required: `collected_at`, `field_id`, `field_label`, `field_type`, `response_value`.
  - Source context: `source_id`, `source_name`.
  - Advanced fields, collapsed: `language`, `user_identifier`, `metadata`, and any less common optional targets.
- Drop `tenant_id` from the UI entirely.
- Hide `source_type` from the UI and save it as static `csv`.
- Prepopulate `source_name` from the uploaded CSV file name, while keeping it editable.
- Auto-map immediately after upload and display review/confidence indicators on mapped fields so users can fix uncertain matches without starting from blank.

## Prepopulation Rules

- `collected_at`: map likely timestamp columns (`timestamp`, `created_at`, `date`, `submitted_at`, etc.); otherwise set static `$now`.
- `source_type`: static `csv`, hidden.
- `source_name`: static uploaded CSV filename, editable.
- `field_id` and `field_label`: both visible and required in the CSV UI; auto-map likely id/question/label columns, but block save if unresolved.
- `field_type`: keep visible and required; auto-suggest from header/sample value, but require a valid enum.
- `response_value`: show one user-facing control and internally route to `value_text`, `value_number`, `value_boolean`, or `value_date` based on selected `field_type`.
- Advanced fields: auto-map if obvious (`language`, `user_id`, `metadata`) but keep them collapsed by default.

## Implementation Approach

- Add CSV-specific field configuration and auto-mapping utilities near [`/Users/johannes/Developer/formbricks/formbricks/apps/web/app/(app)/workspaces/[workspaceId]/unify/sources/types.ts`](</Users/johannes/Developer/formbricks/formbricks/apps/web/app/(app)/workspaces/[workspaceId]/unify/sources/types.ts>) and [`/Users/johannes/Developer/formbricks/formbricks/apps/web/app/(app)/workspaces/[workspaceId]/unify/sources/utils.ts`](</Users/johannes/Developer/formbricks/formbricks/apps/web/app/(app)/workspaces/[workspaceId]/unify/sources/utils.ts>): matching aliases, confidence level, hidden static mappings, and response-value routing.
- Refactor [`MappingUI`](</Users/johannes/Developer/formbricks/formbricks/apps/web/app/(app)/workspaces/[workspaceId]/unify/sources/components/mapping-ui.tsx>) to render CSV-specific groups instead of `requiredFields` and `optionalFields` directly from `FEEDBACK_RECORD_FIELDS`.
- Update [`CsvConnectorUI`](</Users/johannes/Developer/formbricks/formbricks/apps/web/app/(app)/workspaces/[workspaceId]/unify/sources/components/csv-connector-ui.tsx>) so file upload triggers auto-mapping using headers, first-row samples, and CSV filename.
- Update create/edit validation in [`CreateConnectorModal`](</Users/johannes/Developer/formbricks/formbricks/apps/web/app/(app)/workspaces/[workspaceId]/unify/sources/components/create-connector-modal.tsx>), [`EditConnectorModal`](</Users/johannes/Developer/formbricks/formbricks/apps/web/app/(app)/workspaces/[workspaceId]/unify/sources/components/edit-connector-modal.tsx>), and [`connector-form-utils.ts`](</Users/johannes/Developer/formbricks/formbricks/apps/web/app/(app)/workspaces/[workspaceId]/unify/sources/components/connector-form-utils.ts>) to require the CSV UI basics, including `field_label` and `response_value`, not just the raw backend-required fields.
- Update CSV transform/import logic so the synthetic `response_value` mapping is converted to the correct backend target based on `field_type` before creating feedback records.
- Remove unreleased compatibility shims rather than preserving old UI behavior; existing branch data can be replaced by the new mapping contract.
- Add focused Vitest coverage for the new auto-mapping and response-value routing utilities. Avoid `.tsx` component tests per repo guidance.

## Main Edge Cases To Cover

- CSV has no timestamp column: `collected_at` becomes `$now`.
- CSV has ambiguous timestamp columns: choose highest-confidence alias and mark reviewable.
- CSV has no field label/id columns: save is blocked with clear validation.
- CSV field type conflicts with response sample value: route by `field_type`, surface parse failures in existing import result counts/errors.
- CSV filename changes after remapping: update `source_name` only if the user has not manually edited it.
- Advanced auto-detected fields remain editable even while the section is collapsed.
- Hidden `tenant_id` is never persisted from user input; backend predefined value remains source of truth.
- Hidden `source_type=csv` is included in saved mappings/import payload so rows are valid without user action.
