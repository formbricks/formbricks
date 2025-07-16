"use client";

import { Button } from "@/modules/ui/components/button";
import { DialogFooter } from "@/modules/ui/components/dialog";

interface IntegrationModalFooterProps {
  hasExistingIntegration: boolean;
  deleteLabel: string;
  cancelLabel: string;
  submitLabel: string;
  isDeleting: boolean;
  onDelete: () => void;
  onCancel: () => void;
  submitLoading: boolean;
  submitDisabled: boolean;
}

export const IntegrationModalFooter = ({
  hasExistingIntegration,
  deleteLabel,
  cancelLabel,
  submitLabel,
  isDeleting,
  onDelete,
  onCancel,
  submitLoading,
  submitDisabled,
}: IntegrationModalFooterProps) => {
  return (
    <DialogFooter>
      {hasExistingIntegration ? (
        <Button type="button" variant="destructive" loading={isDeleting} onClick={onDelete}>
          {deleteLabel}
        </Button>
      ) : (
        <Button type="button" variant="secondary" onClick={onCancel}>
          {cancelLabel}
        </Button>
      )}
      <Button type="submit" loading={submitLoading} disabled={submitDisabled}>
        {submitLabel}
      </Button>
    </DialogFooter>
  );
};
