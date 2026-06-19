export const WORKFLOW_NAME_MAX_LENGTH = 120;
export const WORKFLOW_DESCRIPTION_MAX_LENGTH = 500;

export interface CreateWorkflowFormErrors {
  nameTooLong: boolean;
  descriptionTooLong: boolean;
}

export interface CreateWorkflowFormValidation {
  trimmedName: string;
  errors: CreateWorkflowFormErrors;
  isValid: boolean;
}

/**
 * Pure client-side validation for the create-workflow form, mirroring the `ZCreateWorkflowInput`
 * bounds (name 1–120 after trim, description ≤500). Kept as a standalone function so the rule is
 * unit-testable without rendering the dialog (the repo covers component interaction via e2e).
 */
export const validateCreateWorkflowForm = (
  name: string,
  description: string
): CreateWorkflowFormValidation => {
  const trimmedName = name.trim();
  const nameTooLong = trimmedName.length > WORKFLOW_NAME_MAX_LENGTH;
  const descriptionTooLong = description.length > WORKFLOW_DESCRIPTION_MAX_LENGTH;

  return {
    trimmedName,
    errors: { nameTooLong, descriptionTooLong },
    isValid: trimmedName.length > 0 && !nameTooLong && !descriptionTooLong,
  };
};
