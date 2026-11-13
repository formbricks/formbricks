"use client";

import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TAuthorizedMcpClientResource } from "@/app/api/internal/mcp-grants/lib/serializers";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { McpGrantDraftFields } from "@/modules/mcp/components/mcp-grant-draft-fields";
import type { TMcpGrantAccessSelection, TMcpGrantPermissions } from "@/modules/mcp/grant";
import { type TMcpGrantAccessOptions, initialMcpGrantAccessDraft } from "@/modules/mcp/grant-access";
import { useMcpGrantDraft } from "@/modules/mcp/hooks/use-mcp-grant-draft";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { useUpdateMcpGrant } from "../hooks/use-update-mcp-grant";

interface EditMcpGrantDialogProps {
  client: TAuthorizedMcpClientResource & {
    permissions: TMcpGrantPermissions;
    access: TMcpGrantAccessSelection;
  };
  /** The organizations and workspaces the access picker offers. */
  accessOptions: TMcpGrantAccessOptions;
  clientName: string;
  isDashboardViewer: boolean;
  onClose: () => void;
}

/**
 * Authorized apps' Edit: the consent screen's organization & workspace access and permission matrix in a
 * dialog, opened with the client's grant and capped by its scopes. Save applies from the client's
 * next call; Cancel discards the changes. Mounted only while open, so each opening starts from the saved
 * grant.
 */
export const EditMcpGrantDialog = ({
  client,
  accessOptions,
  clientName,
  isDashboardViewer,
  onClose,
}: Readonly<EditMcpGrantDialogProps>) => {
  const { t } = useTranslation();
  const draft = useMcpGrantDraft(
    { permissions: client.permissions, access: initialMcpGrantAccessDraft(client.access) },
    { permissions: client.permissions, access: client.access }
  );
  const updateGrant = useUpdateMcpGrant();

  const handleOpenChange = (open: boolean) => {
    if (!open && !updateGrant.isPending) onClose();
  };

  const handleSave = () => {
    if (!draft.accessSelection) return;
    updateGrant.mutate(
      { clientId: client.clientId, permissions: draft.permissions, access: draft.accessSelection },
      {
        onSuccess: () => {
          toast.success(t("auth.oauth.grant_updated"));
          onClose();
        },
        onError: (error) => toast.error(getV3ApiErrorMessage(error, t("auth.oauth.grant_update_failed"))),
      }
    );
  };

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("auth.oauth.edit_access_title", { clientName })}</DialogTitle>
          <DialogDescription>{t("auth.oauth.edit_access_description", { clientName })}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-6 overflow-y-auto px-1 py-4">
          <McpGrantDraftFields
            id={`mcp-edit-${client.clientId}`}
            draft={draft}
            accessOptions={accessOptions}
            cap={client.cap}
            isDashboardViewer={isDashboardViewer}
            emptyHint={t("auth.oauth.edit_empty_grant_hint")}
            disabled={updateGrant.isPending}
          />
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" disabled={updateGrant.isPending} onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            disabled={!draft.canSubmit}
            loading={updateGrant.isPending}
            onClick={handleSave}>
            {t("common.save_changes")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
