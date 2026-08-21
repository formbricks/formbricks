"use client";

import type { TFunction } from "i18next";
import { FilesIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { ApiKeyPermission } from "@formbricks/database/prisma-browser";
import { TOrganizationAccess } from "@formbricks/types/api-key";
import { TUserLocale } from "@formbricks/types/user";
import { timeSince } from "@/lib/time";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { ViewPermissionModal } from "@/modules/organization/settings/api-keys/components/view-permission-modal";
import {
  TApiKeyUpdateInput,
  TApiKeyWithEnvironmentPermission,
  TOrganizationWorkspace,
} from "@/modules/organization/settings/api-keys/types/api-keys";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { SettingsTable, type TSettingsTableColumn } from "@/modules/ui/components/settings-table";
import { createApiKeyAction, deleteApiKeyAction, updateApiKeyAction } from "../actions";
import { AddApiKeyModal } from "./add-api-key-modal";

/** A stored key, plus the plaintext value the create response returns once and only once. */
type TApiKeyRow = TApiKeyWithEnvironmentPermission & { actualKey?: string };

const ApiKeyDisplay = ({ apiKey }: Readonly<{ apiKey: string }>) => {
  const { t } = useTranslation();
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      toast.success(t("workspace.api_keys.api_key_copied_to_clipboard"));
    } catch {
      toast.error(t("workspace.api_keys.unable_to_copy_api_key"));
    }
  };

  if (!apiKey) {
    return <span className="italic">{t("workspace.api_keys.secret")}</span>;
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="break-all whitespace-pre-line">{apiKey}</span>
      {/* `copyApiKeyIcon` is load-bearing: `playwright/lib/utils.ts` waits for and clicks it to read a
          freshly created key, which eight API specs depend on for their bearer token. */}
      <div className="copyApiKeyIcon shrink-0">
        <FilesIcon
          className="size-4 cursor-pointer"
          onClick={(e) => {
            // Stops the click reaching the row, which would open the permissions modal. The column is
            // deliberately not `stopRowClick`: clicking the key *text* has always opened the modal, and
            // only the copy affordance is an exception.
            e.stopPropagation();
            void copyToClipboard();
          }}
          data-testid="copy-button"
        />
      </div>
    </div>
  );
};

/**
 * Exported so `loading.tsx` renders its skeleton from the same column array. That is the whole point of
 * the factory: the old skeleton hand-rolled the header and had drifted to **three** columns against the
 * table's four, which no test could catch.
 *
 * Defined at module level rather than inside the component: an inline `cell` that returns JSX reads as a
 * nested component definition to Sonar (typescript:S6478).
 */
export const getApiKeyColumns = ({
  t,
  locale,
  onDelete,
}: Readonly<{
  t: TFunction;
  locale: TUserLocale;
  onDelete: (event: React.MouseEvent, apiKey: TApiKeyRow) => void;
}>): TSettingsTableColumn<TApiKeyRow>[] => [
  {
    id: "label",
    header: t("common.label"),
    headerClassName: "w-[25%]",
    cellClassName: "font-semibold",
    skeletonWidth: "w-32",
    cell: (apiKey) => apiKey.label,
  },
  {
    id: "apiKey",
    header: t("workspace.api_keys.api_key"),
    headerClassName: "w-[45%]",
    // Replaces `hidden sm:block`, which would have restored a `<td>` to `display: block` and dropped it
    // out of the table's column layout. `hideBelow` uses `table-cell` for exactly that reason.
    hideBelow: "sm",
    skeletonWidth: "w-64",
    cell: (apiKey) => <ApiKeyDisplay apiKey={apiKey.actualKey ?? ""} />,
  },
  {
    id: "createdAt",
    header: t("common.created_at"),
    headerClassName: "w-[20%]",
    skeletonWidth: "w-20",
    cell: (apiKey) => timeSince(apiKey.createdAt.toString(), locale),
  },
  {
    id: "actions",
    header: null,
    srLabel: t("common.actions"),
    headerClassName: "w-[10%]",
    stopRowClick: true,
    skeletonWidth: "w-8",
    // The flex goes on a wrapper inside the cell, never on `cellClassName`: that class lands on the `<td>`
    // itself, and `display: flex` there stops it being a table-cell — which silently kills the shared
    // `align-middle` (`vertical-align` applies only to inline-level and table-cell boxes) and makes the
    // browser wrap the cell in an anonymous table-cell that defaults to baseline alignment. The button
    // would sit high in the row instead of centred. Same reasoning as `hideBelow` above.
    cell: (apiKey) => (
      <div className="flex justify-end">
        <Button
          size="icon"
          variant="ghost"
          aria-label={t("common.delete")}
          onClick={(event) => onDelete(event, apiKey)}>
          <TrashIcon />
        </Button>
      </div>
    ),
  },
];

interface EditAPIKeysProps {
  organizationId: string;
  apiKeys: TApiKeyWithEnvironmentPermission[];
  locale: TUserLocale;
  workspaces: TOrganizationWorkspace[];
  isFormbricksCloud: boolean;
}

export const EditAPIKeys = ({
  organizationId,
  apiKeys,
  locale,
  workspaces,
  isFormbricksCloud,
}: Readonly<EditAPIKeysProps>) => {
  const { t } = useTranslation();
  const [isAddAPIKeyModalOpen, setIsAddAPIKeyModalOpen] = useState(false);
  const [isDeleteKeyModalOpen, setIsDeleteKeyModalOpen] = useState(false);
  const [apiKeysLocal, setApiKeysLocal] = useState<TApiKeyRow[]>(apiKeys);
  const [activeKey, setActiveKey] = useState<TApiKeyWithEnvironmentPermission | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [viewPermissionsOpen, setViewPermissionsOpen] = useState(false);

  const handleOpenDeleteKeyModal = (e: React.MouseEvent, apiKey: TApiKeyWithEnvironmentPermission) => {
    e.preventDefault();
    setActiveKey(apiKey);
    setIsDeleteKeyModalOpen(true);
  };

  const handleDeleteKey = async () => {
    if (!activeKey) return;
    setIsLoading(true);
    const deleteApiKeyResponse = await deleteApiKeyAction({ id: activeKey.id });
    if (deleteApiKeyResponse?.data) {
      const updatedApiKeys = apiKeysLocal?.filter((apiKey) => apiKey.id !== activeKey.id) || [];
      setApiKeysLocal(updatedApiKeys);
      toast.success(t("workspace.api_keys.api_key_deleted"));
      setIsDeleteKeyModalOpen(false);
      setIsLoading(false);
    } else {
      toast.error(t("workspace.api_keys.unable_to_delete_api_key"));
      setIsDeleteKeyModalOpen(false);
      setIsLoading(false);
    }
  };

  const handleAddAPIKey = async (data: {
    label: string;
    workspacePermissions: Array<{
      permission: ApiKeyPermission;
      workspaceId: string;
    }>;
    organizationAccess: TOrganizationAccess;
  }): Promise<void> => {
    setIsLoading(true);
    const createApiKeyResponse = await createApiKeyAction({
      organizationId: organizationId,
      apiKeyData: {
        label: data.label,
        workspacePermissions: data.workspacePermissions,
        organizationAccess: data.organizationAccess,
      },
    });

    if (createApiKeyResponse?.data) {
      const updatedApiKeys = [...apiKeysLocal, createApiKeyResponse.data];
      setApiKeysLocal(updatedApiKeys);
      setIsLoading(false);
      toast.success(t("workspace.api_keys.api_key_created"));
    } else {
      setIsLoading(false);
      const errorMessage = getFormattedErrorMessage(createApiKeyResponse);
      toast.error(errorMessage);
    }

    setIsAddAPIKeyModalOpen(false);
  };

  const handleUpdateAPIKey = async (data: TApiKeyUpdateInput) => {
    if (!activeKey) return;

    const updateApiKeyResponse = await updateApiKeyAction({
      apiKeyId: activeKey.id,
      apiKeyData: data,
    });

    if (updateApiKeyResponse?.data) {
      const updatedApiKeys =
        apiKeysLocal?.map((apiKey) => {
          if (apiKey.id === activeKey.id) {
            return {
              ...apiKey,
              label: data.label,
            };
          }
          return apiKey;
        }) || [];

      setApiKeysLocal(updatedApiKeys);
      toast.success(t("workspace.api_keys.api_key_updated"));
      setIsLoading(false);
    } else {
      const errorMessage = getFormattedErrorMessage(updateApiKeyResponse);
      toast.error(errorMessage);
      setIsLoading(false);
    }

    setViewPermissionsOpen(false);
  };

  return (
    <>
      {/* Moved above the table, matching every other settings table in this series — and required, since
          a flush card body means the table has to be the last thing in it. The control carries the card's
          gutter itself. */}
      <div className="mb-4 flex justify-end px-4 pt-4">
        <Button
          size="sm"
          onClick={() => {
            setIsAddAPIKeyModalOpen(true);
          }}>
          {t("workspace.settings.api_keys.add_api_key")}
        </Button>
      </div>

      <SettingsTable
        columns={getApiKeyColumns({ t, locale, onDelete: handleOpenDeleteKeyModal })}
        rows={apiKeysLocal}
        getRowId={(apiKey) => apiKey.id}
        emptyMessage={t("workspace.api_keys.no_api_keys_yet")}
        getRowProps={() => ({ "data-testid": "api-key-row" })}
        aria-label={t("common.api_keys")}
        onRowClick={(apiKey) => {
          setActiveKey(apiKey);
          setViewPermissionsOpen(true);
        }}
        getRowLabel={(apiKey) => t("workspace.api_keys.view_permissions_for", { label: apiKey.label })}
      />

      <AddApiKeyModal
        open={isAddAPIKeyModalOpen}
        setOpen={setIsAddAPIKeyModalOpen}
        onSubmit={handleAddAPIKey}
        workspaces={workspaces}
        isCreatingAPIKey={isLoading}
        isFormbricksCloud={isFormbricksCloud}
      />
      {activeKey && (
        <ViewPermissionModal
          open={viewPermissionsOpen}
          setOpen={setViewPermissionsOpen}
          onSubmit={handleUpdateAPIKey}
          apiKey={activeKey}
          workspaces={workspaces}
          isUpdating={isLoading}
        />
      )}
      <DeleteDialog
        open={isDeleteKeyModalOpen}
        setOpen={setIsDeleteKeyModalOpen}
        deleteWhat={t("workspace.api_keys.api_key")}
        onDelete={handleDeleteKey}
        isDeleting={isLoading}
        text={t("workspace.api_keys.delete_api_key_confirmation")}
      />
    </>
  );
};
