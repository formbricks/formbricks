"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TMcpConnectionResource } from "@/app/api/internal/mcp-grants/lib/serializers";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { McpGrantAccessSelector } from "@/modules/mcp/components/mcp-grant-access-selector";
import { McpGrantEditor } from "@/modules/mcp/components/mcp-grant-editor";
import type { TMcpGrantAccess, TMcpGrantPermissions } from "@/modules/mcp/grant";
import {
  type TMcpGrantAccessDraft,
  type TMcpGrantAccessOptions,
  initialMcpGrantAccessDraft,
  isSameMcpGrantAccess,
  toMcpGrantAccessSelection,
} from "@/modules/mcp/grant-access";
import { getMcpGrantEditSaveState } from "@/modules/mcp/grant-editor";
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
  connection: TMcpConnectionResource & { permissions: TMcpGrantPermissions; access: TMcpGrantAccess };
  /** The organizations and workspaces the access picker offers. */
  accessOptions: TMcpGrantAccessOptions;
  clientName: string;
  isDashboardViewer: boolean;
  onClose: () => void;
}

/**
 * Authorized apps' Edit: the consent screen's organization & workspace access and permission matrix in a
 * dialog, opened with the connection's grant and capped by its scopes. Save applies from the client's
 * next call; Cancel discards the changes. Mounted only while open, so each opening starts from the saved
 * grant.
 */
export const EditMcpGrantDialog = ({
  connection,
  accessOptions,
  clientName,
  isDashboardViewer,
  onClose,
}: Readonly<EditMcpGrantDialogProps>) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<TMcpGrantPermissions>(connection.permissions);
  const [access, setAccess] = useState<TMcpGrantAccessDraft>(() => initialMcpGrantAccessDraft(connection));
  const updateGrant = useUpdateMcpGrant();
  const permissionsState = getMcpGrantEditSaveState(draft, connection.permissions);
  const { isEmpty } = permissionsState;
  const accessSelection = toMcpGrantAccessSelection(access);
  const accessChanged = accessSelection !== null && !isSameMcpGrantAccess(accessSelection, connection);
  const canSave = !isEmpty && accessSelection !== null && (permissionsState.canSave || accessChanged);

  const handleOpenChange = (open: boolean) => {
    if (!open && !updateGrant.isPending) onClose();
  };

  const handleSave = () => {
    if (!accessSelection) return;
    updateGrant.mutate(
      { clientId: connection.clientId, permissions: draft, access: accessSelection },
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
          <McpGrantAccessSelector
            id={`mcp-access-${connection.consentId}`}
            value={access}
            options={accessOptions}
            onChange={setAccess}
            disabled={updateGrant.isPending}
          />
          <McpGrantEditor
            id={`mcp-grant-${connection.consentId}`}
            permissions={draft}
            cap={connection.cap}
            isDashboardViewer={isDashboardViewer}
            onChange={setDraft}
            disabled={updateGrant.isPending}
          />
          {isEmpty && (
            <output className="block text-sm text-slate-600">{t("auth.oauth.edit_empty_grant_hint")}</output>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" disabled={updateGrant.isPending} onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="button" disabled={!canSave} loading={updateGrant.isPending} onClick={handleSave}>
            {t("common.save_changes")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
