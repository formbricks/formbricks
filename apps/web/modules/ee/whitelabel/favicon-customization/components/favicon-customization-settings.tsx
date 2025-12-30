"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { type ChangeEvent, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TOrganization } from "@formbricks/types/organizations";
import { TAllowedFileExtension } from "@formbricks/types/storage";
import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import {
  removeOrganizationFaviconUrlAction,
  updateOrganizationFaviconUrlAction,
} from "@/modules/ee/whitelabel/favicon-customization/actions";
import { handleFileUpload } from "@/modules/storage/file-upload";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { FileInput } from "@/modules/ui/components/file-input";
import { Input } from "@/modules/ui/components/input";
import { showStorageNotConfiguredToast } from "@/modules/ui/components/storage-not-configured-toast/lib/utils";
import { ModalButton, UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";

// Favicon recommended formats - PNG and ICO are most widely supported
const allowedFileExtensions: TAllowedFileExtension[] = ["png", "jpeg", "jpg", "ico", "webp"];

// Maximum favicon size: 512x512 for high-DPI displays
// File size limit: 100KB (realistically favicons should be much smaller)
const MAX_FAVICON_SIZE_MB = 0.1; // 100KB

interface FaviconCustomizationSettingsProps {
  organization: TOrganization;
  hasWhiteLabelPermission: boolean;
  environmentId: string;
  isReadOnly: boolean;
  isStorageConfigured: boolean;
}

export const FaviconCustomizationSettings = ({
  organization,
  hasWhiteLabelPermission,
  environmentId,
  isReadOnly,
  isStorageConfigured,
}: FaviconCustomizationSettingsProps) => {
  const { t } = useTranslation();
  const router = useRouter();

  const [faviconUrl, setFaviconUrl] = useState<string | undefined>(
    organization.whitelabel?.faviconUrl || undefined
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (file: File) => {
    setIsLoading(true);
    try {
      const uploadResult = await handleFileUpload(file, environmentId, allowedFileExtensions);
      if (uploadResult.error) {
        toast.error(uploadResult.error);
        return;
      }
      setFaviconUrl(uploadResult.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.something_went_wrong"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!isStorageConfigured) {
      showStorageNotConfiguredToast();
      return;
    }
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size
    const fileSizeInMB = file.size / 1000000;
    if (fileSizeInMB > MAX_FAVICON_SIZE_MB) {
      toast.error(t("environments.settings.domain.favicon_too_large"));
      return;
    }

    await handleImageUpload(file);
    setIsEditing(true);
  };

  const saveChanges = async () => {
    if (!isEditing) {
      setIsEditing(true);
      return;
    }

    if (!faviconUrl) return;

    setIsLoading(true);
    try {
      const updateFaviconResponse = await updateOrganizationFaviconUrlAction({
        organizationId: organization.id,
        faviconUrl,
      });

      if (updateFaviconResponse?.data) {
        toast.success(t("environments.settings.domain.favicon_saved_successfully"));
        router.refresh();
      } else {
        const errorMessage = getFormattedErrorMessage(updateFaviconResponse);
        toast.error(errorMessage);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.something_went_wrong"));
    } finally {
      setIsLoading(false);
      setIsEditing(false);
    }
  };

  const removeFavicon = async () => {
    setFaviconUrl(undefined);

    if (!organization.whitelabel?.faviconUrl) {
      setIsEditing(false);
      return;
    }

    setIsLoading(true);
    try {
      const removeFaviconResponse = await removeOrganizationFaviconUrlAction({
        organizationId: organization.id,
      });

      if (removeFaviconResponse?.data) {
        toast.success(t("environments.settings.domain.favicon_removed_successfully"));
        router.refresh();
      } else {
        const errorMessage = getFormattedErrorMessage(removeFaviconResponse);
        toast.error(errorMessage);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.something_went_wrong"));
    } finally {
      setIsLoading(false);
      setIsEditing(false);
    }
  };

  const buttons: [ModalButton, ModalButton] = [
    {
      text: t("common.start_free_trial"),
      href: `/environments/${environmentId}/settings/billing`,
    },
    {
      text: t("common.learn_more"),
      href: `/environments/${environmentId}/settings/billing`,
    },
  ];

  return (
    <SettingsCard
      title={t("environments.settings.domain.favicon_customization")}
      description={t("environments.settings.domain.favicon_customization_description")}>
      {hasWhiteLabelPermission ? (
        <div className="w-full space-y-4">
          {faviconUrl ? (
            <Image
              src={faviconUrl}
              alt="Favicon"
              width={64}
              height={64}
              className="-mb-2 h-16 w-16 rounded-lg border object-contain p-1"
            />
          ) : (
            <FileInput
              id="favicon-input"
              allowedFileExtensions={allowedFileExtensions}
              environmentId={environmentId}
              onFileUpload={(files: string[]) => {
                setFaviconUrl(files[0]);
                setIsEditing(true);
              }}
              disabled={isReadOnly}
              maxSizeInMB={MAX_FAVICON_SIZE_MB}
              isStorageConfigured={isStorageConfigured}
            />
          )}

          <Input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg, image/png, image/webp, image/x-icon, image/ico"
            className="hidden"
            disabled={isReadOnly}
            onChange={handleFileChange}
          />

          {isEditing && faviconUrl && (
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  if (!isStorageConfigured) {
                    showStorageNotConfiguredToast();
                    return;
                  }
                  fileInputRef.current?.click();
                }}
                variant="secondary"
                size="sm">
                {t("common.replace")}
              </Button>
              <Button variant="destructive" size="sm" onClick={removeFavicon} disabled={!isEditing}>
                {t("common.remove")}
              </Button>
            </div>
          )}

          {faviconUrl && (
            <Button onClick={saveChanges} disabled={isLoading || isReadOnly} size="sm">
              {isEditing ? t("common.save") : t("common.edit")}
            </Button>
          )}

          <Alert variant="info">
            <AlertDescription>{t("environments.settings.domain.favicon_size_hint")}</AlertDescription>
          </Alert>

          {isReadOnly && (
            <Alert variant="warning">
              <AlertDescription>
                {t("common.only_owners_managers_and_manage_access_members_can_perform_this_action")}
              </AlertDescription>
            </Alert>
          )}
        </div>
      ) : (
        <UpgradePrompt
          title={t("environments.settings.domain.customize_favicon_with_higher_plan")}
          description={t("environments.settings.domain.customize_favicon_description")}
          buttons={buttons}
        />
      )}
    </SettingsCard>
  );
};
