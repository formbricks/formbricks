"use client";

import { RepeatIcon, Trash2Icon } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import React, { useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TOrganization } from "@formbricks/types/organizations";
import { TAllowedFileExtension } from "@formbricks/types/storage";
import { TUser } from "@formbricks/types/user";
import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import { cn } from "@/lib/cn";
import { isExternalImageSrc } from "@/lib/image-hosts";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import {
  removeOrganizationEmailLogo,
  sendOrganizationTestEmail,
  updateOrganizationEmailLogo,
} from "@/modules/ee/whitelabel/email-customization/lib/api-client";
import { handleFileUpload } from "@/modules/storage/file-upload";
import { showFileUploadErrorToast } from "@/modules/storage/file-upload-error";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { Uploader } from "@/modules/ui/components/file-input/components/uploader";
import { showStorageNotConfiguredToast } from "@/modules/ui/components/storage-not-configured-toast/lib/utils";
import { Muted, P, Small } from "@/modules/ui/components/typography";
import { ModalButton, UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";

const allowedFileExtensions: TAllowedFileExtension[] = ["jpeg", "png", "jpg", "webp"];

interface EmailCustomizationSettingsProps {
  readonly organization: TOrganization;
  readonly hasWhiteLabelPermission: boolean;
  readonly workspaceId: string;
  readonly isReadOnly: boolean;
  readonly isFormbricksCloud: boolean;
  readonly user: TUser | null;
  readonly fbLogoUrl: string;
  readonly isStorageConfigured: boolean;
  readonly enterpriseLicenseRequestFormUrl: string;
}

export const EmailCustomizationSettings = ({
  organization,
  hasWhiteLabelPermission,
  workspaceId,
  isReadOnly,
  isFormbricksCloud,
  user,
  fbLogoUrl,
  isStorageConfigured,
  enterpriseLicenseRequestFormUrl,
}: EmailCustomizationSettingsProps) => {
  const { t } = useTranslation();

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState<string>(organization.whitelabel?.logoUrl || fbLogoUrl);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null) as React.RefObject<HTMLInputElement>;

  const isDefaultLogo = logoUrl === fbLogoUrl;

  const router = useRouter();

  const onFileInputChange = (files: File[]) => {
    if (!isStorageConfigured) {
      showStorageNotConfiguredToast();
      return;
    }

    const file = files[0];
    if (!file) return;

    // Revoke any previous object URL so we don't leak memory
    if (logoUrl) {
      URL.revokeObjectURL(logoUrl);
    }

    setLogoFile(file);
    setLogoUrl(URL.createObjectURL(file));
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

    const extension = file.name.split(".").pop()! as TAllowedFileExtension;
    if (!allowedFileExtensions.includes(extension)) {
      toast.error(t("common.invalid_file_type"));
      return;
    }
    onFileInputChange(files);
  };

  const removeLogo = async () => {
    if (logoUrl) {
      URL.revokeObjectURL(logoUrl);
    }
    setLogoFile(null);
    setLogoUrl("");

    if (inputRef.current) {
      inputRef.current.value = "";
    }

    if (isDefaultLogo || !organization.whitelabel?.logoUrl) return;

    try {
      await removeOrganizationEmailLogo(organization.id);
      toast.success(t("workspace.settings.general.logo_removed_successfully"));
      router.refresh();
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again")));
    }
  };

  const handleSave = async () => {
    if (!logoFile) return;
    setIsSaving(true);
    const { url, error } = await handleFileUpload(logoFile, workspaceId, allowedFileExtensions);

    if (error) {
      showFileUploadErrorToast(error, t);
      setIsSaving(false);
      return;
    }

    try {
      await updateOrganizationEmailLogo(organization.id, url);
      toast.success(t("workspace.settings.general.logo_saved_successfully"));
      setLogoUrl(url);
      router.refresh();
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again")));
    }

    setIsSaving(false);
  };

  const sendTestEmail = async () => {
    if (!logoUrl) {
      toast.error(t("workspace.settings.general.please_add_a_logo"));
      return;
    }
    if (logoUrl !== organization.whitelabel?.logoUrl && !isDefaultLogo) {
      toast.error(t("workspace.settings.general.please_save_logo_before_sending_test_email"));
      return;
    }
    try {
      await sendOrganizationTestEmail(organization.id);
      toast.success(t("workspace.settings.general.test_email_sent_successfully"));
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again")));
    }
  };

  const buttons: [ModalButton, ModalButton] = [
    {
      text: isFormbricksCloud ? t("common.upgrade_plan") : t("common.request_trial_license"),
      href: isFormbricksCloud
        ? `/organizations/${organization.id}/settings/billing`
        : enterpriseLicenseRequestFormUrl,
    },
    {
      text: t("common.learn_more"),
      href: isFormbricksCloud
        ? `/organizations/${organization.id}/settings/billing`
        : "https://formbricks.com/learn-more-self-hosting-license?utm_source=formbricks-app&utm_medium=webapp&utm_campaign=ee_lock_email_whitelabel",
    },
  ];

  return (
    <SettingsCard
      className="overflow-hidden pb-0"
      title={t("workspace.look.email_customization")}
      description={t("workspace.look.email_customization_description")}
      bodyVariant="bleed">
      <div className="px-6 pt-6">
        {hasWhiteLabelPermission ? (
          <div className="flex items-end justify-between gap-4">
            <div className="mb-10">
              <Small>{t("workspace.settings.general.logo_in_email_header")}</Small>

              <div className="mt-2 mb-6 flex items-center gap-4">
                {logoUrl && (
                  <div className="flex flex-col gap-2">
                    <div className="flex w-max items-center justify-center rounded-lg border border-slate-200 px-4 py-2">
                      <Image
                        src={logoUrl}
                        alt="Logo"
                        className="max-h-24 max-w-full object-contain"
                        width={192}
                        height={192}
                        unoptimized={isExternalImageSrc(logoUrl)}
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        data-testid="replace-logo-button"
                        variant="secondary"
                        onClick={() => {
                          if (!isStorageConfigured) {
                            showStorageNotConfiguredToast();
                            return;
                          }
                          inputRef.current?.click();
                        }}
                        disabled={isReadOnly || isSaving}>
                        <RepeatIcon className="size-4" />
                        {t("workspace.settings.general.replace_logo")}
                      </Button>
                      <Button
                        data-testid="remove-logo-button"
                        onClick={removeLogo}
                        variant="outline"
                        disabled={isReadOnly || isSaving}>
                        <Trash2Icon className="size-4" />
                        {t("workspace.settings.general.remove_logo")}
                      </Button>
                    </div>
                  </div>
                )}
                <Uploader
                  ref={inputRef}
                  allowedFileExtensions={allowedFileExtensions}
                  id="email-customization"
                  name="email-customization"
                  handleDragOver={handleDragOver}
                  uploaderClassName={cn(
                    "h-20 w-96 border border-slate-200 bg-white",
                    logoUrl ? "hidden" : "block"
                  )}
                  handleDrop={handleDrop}
                  multiple={false}
                  handleUpload={onFileInputChange}
                  disabled={isReadOnly}
                  isStorageConfigured={isStorageConfigured}
                />
              </div>

              <div className="flex gap-4">
                <Button
                  data-testid="send-test-email-button"
                  variant="secondary"
                  disabled={isReadOnly || isSaving}
                  onClick={sendTestEmail}>
                  {t("common.send_test_email")}
                </Button>
                <Button onClick={handleSave} disabled={!logoFile || isReadOnly} loading={isSaving}>
                  {t("common.save")}
                </Button>
              </div>
            </div>
            <div className="min-h-52 w-[446px] rounded-t-lg border border-slate-100 px-10 pt-10 pb-4 shadow-card-xl">
              <Image
                data-testid="email-customization-preview-image"
                src={logoUrl || fbLogoUrl}
                alt="Logo"
                className="mx-auto max-h-[100px] max-w-full object-contain"
                width={192}
                height={192}
                unoptimized={isExternalImageSrc(logoUrl || fbLogoUrl)}
              />
              <P className="font-bold">
                {t("workspace.settings.general.email_customization_preview_email_heading", {
                  userName: user?.name,
                })}
              </P>
              <Muted className="text-slate-500">
                {t("workspace.settings.general.email_customization_preview_email_text")}
              </Muted>
            </div>
          </div>
        ) : (
          <UpgradePrompt
            title={t("workspace.settings.general.customize_email_with_a_higher_plan")}
            description={t("workspace.settings.general.eliminate_branding_with_whitelabel")}
            buttons={buttons}
            feature="email_customization"
          />
        )}

        {hasWhiteLabelPermission && isReadOnly && (
          <Alert variant="warning" className="mt-4 mb-6" role="status">
            <AlertDescription>
              {t("common.only_owners_managers_and_manage_access_members_can_perform_this_action")}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </SettingsCard>
  );
};
