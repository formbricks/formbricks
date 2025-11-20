<!-- 13337535-c870-4388-8764-b5fb419d78e4 7b3ece41-8936-4c54-9f58-adfadf0fb958 -->
# Survey JSON Export/Import Implementation

## Overview

Add the ability to export surveys as JSON files and import them back with proper validation, resource handling, and user feedback.

## 1. Export Functionality

### Add Export Menu Item

**File:** `apps/web/modules/survey/list/components/survey-dropdown-menu.tsx`

- Add `DownloadIcon` from lucide-react to imports
- Add new `DropdownMenuItem` after "Copy" item (around line 186)
- Add handler function `handleExportSurvey` that calls server action and triggers download

### Create Export Server Action

**File:** `apps/web/modules/survey/list/actions.ts` (add new action)

- Create `exportSurveyAction` that:
  - Fetches survey with `getSurveyAction`
  - Returns full survey object as JSON string (no field stripping)
  - Provides transparency and complete audit trail
  - Import will handle all field transformation and validation

### Download Helper

**File:** `apps/web/modules/survey/list/lib/download-survey.ts` (new file)

- Create `downloadSurveyJson(surveyName: string, jsonContent: string)` function
- Similar to `downloadResponsesFile` pattern in `apps/web/app/(app)/environments/[environmentId]/surveys/[surveyId]/utils.ts`
- Creates file with name: `{survey-name}-export-{date}.json`

## 2. Import Functionality

### Add Import Button

**File:** `apps/web/modules/survey/list/components/survey-list.tsx`

- Add "Import Survey" button next to survey creation buttons (if survey creation is allowed)
- Opens import modal on click

### Create Import Modal Component

**File:** `apps/web/modules/survey/list/components/import-survey-modal.tsx` (new file)

- Pattern similar to `apps/web/modules/ee/contacts/components/upload-contacts-button.tsx`
- **Step 1: File Upload**
  - File input accepting `.json` only
  - Parse JSON on file selection
  - Call validation action
- **Step 2: Preview & Configure**
  - Show validation results (errors/warnings)
  - **Warnings to display:**
    - Enterprise features that will be stripped (multi-language, follow-ups, recaptcha)
    - Images detected that need reuploading
    - Segments will be removed
  - **Errors that block import:**
    - Invalid JSON structure
    - Missing required fields
    - Invalid Zod validation
  - **Configuration fields:**
    - Survey name input (pre-filled with original name + " (imported)")
    - Display new survey ID using ID component from `@/modules/ui/components/id`
  - Import button (disabled if errors exist)

### Create Import Server Actions

**File:** `apps/web/modules/survey/list/actions.ts` (add new actions)

#### Validation Action: `validateSurveyImportAction`

- Input: parsed JSON object + environmentId
- Returns: `{ valid: boolean, errors: string[], warnings: string[], surveyName: string, hasImages: boolean, willStripFeatures: { multiLanguage: boolean, followUps: boolean, recaptcha: boolean } }`
- Validates:
  - Zod parse with `ZSurveyCreateInput`
  - Check organization permissions for enterprise features using existing helpers:
    - `checkMultiLanguagePermission(organizationId)` from `@/modules/ee/multi-language-surveys/lib/actions`
    - `checkSpamProtectionPermission(organizationId)` from `@/modules/survey/lib/permission`
    - `getSurveyFollowUpsPermission(organizationBilling.plan)` from `@/modules/survey/follow-ups/lib/utils`
  - Use try-catch on permission checks to determine what will be stripped (don't throw, just track)
  - Detect images in questions using `checkForInvalidImagesInQuestions` pattern
- Build warnings array for features that will be stripped

#### Import Action: `importSurveyAction`

- Input: validated survey JSON + environmentId + newName
- Process:

  1. Re-validate JSON (security)
  2. Generate new survey ID
  3. Set name to `newName`
  4. Strip enterprise features if no permission (set to defaults)
  5. Set `segment: null`
  6. **Handle triggers:**

     - Check if action classes exist in target environment
     - If not, create new action classes with flag/suffix
     - Use `handleTriggerUpdates` from `apps/web/modules/survey/editor/lib/survey.ts`

  1. Call `createSurvey` from `apps/web/modules/survey/components/template-list/lib/survey.ts`
  2. Return new survey ID for redirect

### Helper Functions

**File:** `apps/web/modules/survey/lib/import-validation.ts` (new file)

- `detectImagesInSurvey(survey: TSurveyCreateInput): boolean`
  - Check all questions for image fields
  - Return true if any images found
- `stripEnterpriseFeatures(survey: TSurveyCreateInput, permissions: { hasMultiLanguage, hasFollowUps, hasRecaptcha }): TSurveyCreateInput`
  - Remove/reset features based on permissions
  - Return cleaned survey
- `getImportWarnings(survey: TSurveyCreateInput, hasImages: boolean, permissions: object): string[]`
  - Build array of warning messages for UI

## 3. Translation Keys

**File:** `apps/web/locales/en-US.json`

Add under `environments.surveys`:

```json
"export_survey": "Export survey",
"import_survey": "Import Survey",
"import_survey_description": "Import a survey from a JSON file",
"import_survey_validate": "Validate Survey",
"import_survey_import": "Import Survey",
"import_survey_name_label": "Survey Name",
"import_survey_new_id": "New Survey ID",
"import_survey_file_label": "Select JSON file",
"import_survey_warnings": "Warnings",
"import_survey_errors": "Errors",
"import_survey_success": "Survey imported successfully",
"import_survey_error": "Failed to import survey",
"import_warning_multi_language": "Multi-language surveys require an enterprise plan. Languages will be removed.",
"import_warning_follow_ups": "Survey follow-ups require an enterprise plan. Follow-ups will be removed.",
"import_warning_recaptcha": "Spam protection requires an enterprise plan. reCAPTCHA will be disabled.",
"import_warning_images": "Images detected in survey. You'll need to re-upload images after import.",
"import_warning_segments": "Segment targeting will be removed. Configure targeting after import.",
"import_error_invalid_json": "Invalid JSON file",
"import_error_validation": "Survey validation failed"
```

## 4. Edge Cases Handled

1. **Action Classes (Triggers):** Auto-create in target environment with "(imported)" suffix if don't exist
2. **Segments:** Always set to null, show warning
3. **Enterprise Features:** Check permissions, strip if not available, show warnings
4. **Images:** Detect and warn user they need manual reupload
5. **IDs:** Always generate new, show clearly in UI
6. **Invalid JSON:** Show error, block import
7. **Server-side Validation:** All validation happens server-side with loading states

## 5. Testing Considerations

- Test export with surveys of all types (link, app, website)
- Test import into same environment (action classes exist)
- Test import into different environment (action classes don't exist)
- Test import with/without enterprise permissions
- Test with invalid JSON
- Test with surveys containing images
- Test name collision handling

### To-dos

- [ ] Add export menu item to survey dropdown
- [ ] Create exportSurveyAction server action
- [ ] Create download helper for JSON files
- [ ] Add Import Survey button to survey list
- [ ] Build import modal with validation preview
- [ ] Create validateSurveyImportAction
- [ ] Create importSurveyAction with resource handling
- [ ] Create helper functions for import validation
- [ ] Add translation keys for import/export
- [ ] Test complete export/import flow