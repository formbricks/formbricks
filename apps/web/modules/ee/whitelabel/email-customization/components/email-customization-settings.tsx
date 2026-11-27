"use client";

import { RepeatIcon, Trash2Icon } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import React, { useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getDroppedFiles, setDropEffect } from "@formbricks/survey-ui/drag-data";
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
import { getEmailLogoPreviewUrl } from "@/modules/ee/whitelabel/email-customization/lib/email-logo";
import { handleFileUpload } from "@/modules/storage/file-upload";
import { showFileUploadErrorToast } from "@/modules/storage/file-upload-error";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
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
  // An empty `logoUrl` means no logo at all.
  const [logoUrl, setLogoUrl] = useState<string>(() =>
    getEmailLogoPreviewUrl(organization.whitelabel, fbLogoUrl)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null) as React.RefObject<HTMLInputElement>;

  const router = useRouter();

  const onFileInputChange = (files: File[]) => {
    if (!isStorageConfigured) {
      showStorageNotConfiguredToast();
      return;
    }

    const file = files[0];
    if (!file) return;

    // Revoke any previous object URL so we don't leak memory
    if (logoFile) {
      URL.revokeObjectURL(logoUrl);
    }

    setLogoFile(file);
    setLogoUrl(URL.createObjectURL(file));
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDropEffect(e, "copy");
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isStorageConfigured) {
      showStorageNotConfiguredToast();
      return;
    }

    const files = getDroppedFiles(e);
    const file = files[0];
    if (!file) return;

    const extension = file.name.split(".").pop()! as TAllowedFileExtension;
    if (!allowedFileExtensions.includes(extension)) {
      toast.error(t("common.invalid_file_type"));
      return;
    }
    onFileInputChange(files);
  };

  // Removing always persists, the Formbricks logo included: it records that emails carry no logo.
  const removeLogo = async () => {
    setIsRemoving(true);
    try {
      await removeOrganizationEmailLogo(organization.id);
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again")));
      setIsRemoving(false);
      setIsRemoveDialogOpen(false);
      return;
    }

    if (logoFile) {
      URL.revokeObjectURL(logoUrl);
    }
    setLogoFile(null);
    setLogoUrl("");
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    setIsRemoving(false);
    setIsRemoveDialogOpen(false);
    toast.success(t("workspace.settings.general.logo_removed_successfully"));
    router.refresh();
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
      URL.revokeObjectURL(logoUrl);
      setLogoFile(null);
      setLogoUrl(url);
      router.refresh();
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again")));
    }

    setIsSaving(false);
  };

  const sendTestEmail = async () => {
    // A picked logo is only a preview until it's saved; the test email uses the saved state, which
    // may be no logo at all.
    if (logoFile) {
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
                        onClick={() => setIsRemoveDialogOpen(true)}
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
              {logoUrl && (
                <Image
                  data-testid="email-customization-preview-image"
                  src={logoUrl}
                  alt="Logo"
                  className="mx-auto max-h-[100px] max-w-full object-contain"
                  width={192}
                  height={192}
                  unoptimized={isExternalImageSrc(logoUrl)}
                />
              )}
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

        <DeleteDialog
          open={isRemoveDialogOpen}
          setOpen={setIsRemoveDialogOpen}
          deleteWhat={t("common.logo")}
          text={t("workspace.look.remove_logo_confirmation")}
          onDelete={removeLogo}
          isDeleting={isRemoving}
        />

        {hasWhiteLabelPermission && isReadOnly && (
          <Alert variant="warning" className="mt-4 mb-6" alertRole="status">
            <AlertDescription>
              {t("common.only_owners_managers_and_manage_access_members_can_perform_this_action")}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </SettingsCard>
  );
};
