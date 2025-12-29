"use client";

import { RepeatIcon, Trash2Icon } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import React, { useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TOrganization } from "@formbricks/types/organizations";
import { TAllowedFileExtension } from "@formbricks/types/storage";
import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { cn } from "@/lib/cn";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import {
  removeOrganizationFaviconUrlAction,
  updateOrganizationFaviconUrlAction,
} from "@/modules/ee/whitelabel/favicon-customization/actions";
import { handleFileUpload } from "@/modules/storage/file-upload";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { Uploader } from "@/modules/ui/components/file-input/components/uploader";
import { showStorageNotConfiguredToast } from "@/modules/ui/components/storage-not-configured-toast/lib/utils";
import { Muted, Small } from "@/modules/ui/components/typography";
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
  isFormbricksCloud: boolean;
  isStorageConfigured: boolean;
}

export const FaviconCustomizationSettings = ({
  organization,
  hasWhiteLabelPermission,
  environmentId,
  isReadOnly,
  isFormbricksCloud,
  isStorageConfigured,
}: FaviconCustomizationSettingsProps) => {
  const { t } = useTranslation();

  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [faviconUrl, setFaviconUrl] = useState<string>(organization.whitelabel?.faviconUrl || "");
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const router = useRouter();

  const onFileInputChange = (files: File[]) => {
    if (!isStorageConfigured) {
      showStorageNotConfiguredToast();
      return;
    }

    const file = files[0];
    if (!file) return;

    // Validate file size
    const fileSizeInMB = file.size / 1000000;
    if (fileSizeInMB > MAX_FAVICON_SIZE_MB) {
      toast.error(t("environments.settings.domain.favicon_too_large"));
      return;
    }

    // Revoke any previous object URL so we don't leak memory
    if (faviconUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(faviconUrl);
    }

    setFaviconFile(file);
    setFaviconUrl(URL.createObjectURL(file));
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isStorageConfigured) {
      showStorageNotConfiguredToast();
      return;
    }

    const files = Array.from(e.dataTransfer.files);
    const file = files[0];
    if (!file) return;

    const extension = file.name.split(".").pop()?.toLowerCase() as TAllowedFileExtension;
    if (!allowedFileExtensions.includes(extension)) {
      toast.error(t("common.invalid_file_type"));
      return;
    }
    onFileInputChange(files);
  };

  const removeFavicon = async () => {
    if (faviconUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(faviconUrl);
    }
    setFaviconFile(null);
    setFaviconUrl("");

    if (inputRef.current) {
      inputRef.current.value = "";
    }

    if (!organization.whitelabel?.faviconUrl) return;

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
  };

  const handleSave = async () => {
    if (!faviconFile) return;
    setIsSaving(true);
    const { url, error } = await handleFileUpload(faviconFile, environmentId, allowedFileExtensions);

    if (error) {
      toast.error(error);
      setIsSaving(false);
      return;
    }

    const updateFaviconResponse = await updateOrganizationFaviconUrlAction({
      organizationId: organization.id,
      faviconUrl: url,
    });

    if (updateFaviconResponse?.data) {
      toast.success(t("environments.settings.domain.favicon_saved_successfully"));
      setFaviconUrl(url);
      setFaviconFile(null);
      router.refresh();
    } else {
      const errorMessage = getFormattedErrorMessage(updateFaviconResponse);
      toast.error(errorMessage);
    }

    setIsSaving(false);
  };

  const buttons: [ModalButton, ModalButton] = [
    {
      text: isFormbricksCloud ? t("common.start_free_trial") : t("common.request_trial_license"),
      href: isFormbricksCloud
        ? `/environments/${environmentId}/settings/billing`
        : "https://formbricks.com/upgrade-self-hosting-license",
    },
    {
      text: t("common.learn_more"),
      href: isFormbricksCloud
        ? `/environments/${environmentId}/settings/billing`
        : "https://formbricks.com/learn-more-self-hosting-license",
    },
  ];

  return (
    <SettingsCard
      title={t("environments.settings.domain.favicon_customization")}
      description={t("environments.settings.domain.favicon_customization_description")}>
      {hasWhiteLabelPermission ? (
        <div className="flex flex-col gap-4">
          <Small>{t("environments.settings.domain.favicon_for_link_surveys")}</Small>

          <div className="flex items-center gap-4">
            {faviconUrl && (
              <div className="flex flex-col gap-2">
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-slate-200 bg-white p-2">
                  <Image
                    src={faviconUrl}
                    alt="Favicon"
                    className="max-h-full max-w-full object-contain"
                    width={48}
                    height={48}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={isReadOnly || isSaving}
                    onClick={() => {
                      if (!isStorageConfigured) {
                        showStorageNotConfiguredToast();
                        return;
                      }
                      inputRef.current?.click();
                    }}>
                    <RepeatIcon className="h-4 w-4" />
                    {t("common.replace")}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={isReadOnly || isSaving}
                    onClick={removeFavicon}>
                    <Trash2Icon className="h-4 w-4" />
                    {t("common.remove")}
                  </Button>
                </div>
              </div>
            )}

            <Uploader
              id="favicon"
              name="favicon-file"
              handleDragOver={handleDragOver}
              uploaderClassName={cn("h-24 w-52", faviconUrl ? "hidden" : "block")}
              handleDrop={handleDrop}
              allowedFileExtensions={allowedFileExtensions}
              multiple={false}
              handleUpload={onFileInputChange}
              disabled={isReadOnly}
              isStorageConfigured={isStorageConfigured}
            />
          </div>

          <Muted>{t("environments.settings.domain.favicon_size_hint")}</Muted>

          {faviconFile && (
            <div className="flex gap-2">
              <Button onClick={handleSave} loading={isSaving} disabled={isReadOnly}>
                {t("common.save")}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  if (faviconUrl.startsWith("blob:")) {
                    URL.revokeObjectURL(faviconUrl);
                  }
                  setFaviconFile(null);
                  setFaviconUrl(organization.whitelabel?.faviconUrl || "");
                }}>
                {t("common.cancel")}
              </Button>
            </div>
          )}

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
