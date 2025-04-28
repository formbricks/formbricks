"use client";

import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { cn } from "@/lib/cn";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import {
  removeOrganizationEmailLogoUrlAction,
  sendTestEmailAction,
  updateOrganizationEmailLogoUrlAction,
} from "@/modules/ee/whitelabel/email-customization/actions";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { Uploader } from "@/modules/ui/components/file-input/components/uploader";
import { uploadFile } from "@/modules/ui/components/file-input/lib/utils";
import { Muted, P, Small } from "@/modules/ui/components/typography";
import { ModalButton, UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";
import { useTranslate } from "@tolgee/react";
import { RepeatIcon, Trash2Icon } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import React, { useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { TAllowedFileExtension } from "@formbricks/types/common";
import { TOrganization } from "@formbricks/types/organizations";
import { TUser } from "@formbricks/types/user";

const allowedFileExtensions: TAllowedFileExtension[] = ["jpeg", "png", "jpg", "webp"];

interface EmailCustomizationSettingsProps {
  organization: TOrganization;
  hasWhiteLabelPermission: boolean;
  environmentId: string;
  isReadOnly: boolean;
  isFormbricksCloud: boolean;
  user: TUser | null;
  fbLogoUrl: string;
}

export const EmailCustomizationSettings = ({
  organization,
  hasWhiteLabelPermission,
  environmentId,
  isReadOnly,
  isFormbricksCloud,
  user,
  fbLogoUrl,
}: EmailCustomizationSettingsProps) => {
  const { t } = useTranslate();

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState<string>(organization.whitelabel?.logoUrl || fbLogoUrl);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null) as React.RefObject<HTMLInputElement>;

  const isDefaultLogo = logoUrl === fbLogoUrl;

  const router = useRouter();

  const onFileInputChange = (files: File[]) => {
    const file = files[0];
    if (!file) return;

    // Revoke any previous object URL so we don’t leak memory
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

    const removeLogoResponse = await removeOrganizationEmailLogoUrlAction({
      organizationId: organization.id,
    });

    if (removeLogoResponse?.data) {
      toast.success(t("environments.settings.general.logo_removed_successfully"));
      router.refresh();
    } else {
      const errorMessage = getFormattedErrorMessage(removeLogoResponse);
      toast.error(errorMessage);
    }
  };

  const handleSave = async () => {
    if (!logoFile) return;
    setIsSaving(true);
    const { url } = await uploadFile(logoFile, allowedFileExtensions, environmentId);

    const updateLogoResponse = await updateOrganizationEmailLogoUrlAction({
      organizationId: organization.id,
      logoUrl: url,
    });

    if (updateLogoResponse?.data) {
      toast.success(t("environments.settings.general.logo_saved_successfully"));
      setLogoUrl(url);
      router.refresh();
    } else {
      const errorMessage = getFormattedErrorMessage(updateLogoResponse);
      toast.error(errorMessage);
    }

    setIsSaving(false);
  };

  const sendTestEmail = async () => {
    if (!logoUrl) {
      toast.error(t("environments.settings.general.please_add_a_logo"));
      return;
    }
    if (logoUrl !== organization.whitelabel?.logoUrl && !isDefaultLogo) {
      toast.error(t("environments.settings.general.please_save_logo_before_sending_test_email"));
      return;
    }
    const sendTestEmailResponse = await sendTestEmailAction({
      organizationId: organization.id,
    });

    if (sendTestEmailResponse?.data) {
      toast.success(t("environments.settings.general.test_email_sent_successfully"));
    } else {
      const errorMessage = getFormattedErrorMessage(sendTestEmailResponse);
      toast.error(errorMessage);
    }
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
      className="overflow-hidden pb-0"
      title={t("environments.project.look.email_customization")}
      description={t("environments.project.look.email_customization_description")}
      noPadding>
      <div className="px-6 pt-6">
        {hasWhiteLabelPermission ? (
          <div className="flex items-end justify-between gap-4">
            <div className="mb-10">
              <Small>{t("environments.settings.general.logo_in_email_header")}</Small>

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
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        data-testid="replace-logo-button"
                        variant="secondary"
                        onClick={() => inputRef.current?.click()}
                        disabled={isReadOnly}>
                        <RepeatIcon className="h-4 w-4" />
                        {t("environments.settings.general.replace_logo")}
                      </Button>
                      <Button
                        data-testid="remove-logo-button"
                        onClick={removeLogo}
                        variant="outline"
                        disabled={isReadOnly}>
                        <Trash2Icon className="h-4 w-4" />
                        {t("environments.settings.general.remove_logo")}
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
                />
              </div>

              <div className="flex gap-4">
                <Button
                  data-testid="send-test-email-button"
                  variant="secondary"
                  disabled={isReadOnly}
                  onClick={sendTestEmail}>
                  {t("common.send_test_email")}
                </Button>
                <Button onClick={handleSave} disabled={!logoFile || isReadOnly} loading={isSaving}>
                  {t("common.save")}
                </Button>
              </div>
            </div>
            <div className="shadow-card-xl min-h-52 w-[446px] rounded-t-lg border border-slate-100 px-10 pt-10 pb-4">
              <Image
                data-testid="email-customization-preview-image"
                src={logoUrl || fbLogoUrl}
                alt="Logo"
                className="mx-auto max-h-[100px] max-w-full object-contain"
                width={192}
                height={192}
              />
              <P className="font-bold">
                {t("environments.settings.general.email_customization_preview_email_heading", {
                  userName: user?.name,
                })}
              </P>
              <Muted className="text-slate-500">
                {t("environments.settings.general.email_customization_preview_email_text")}
              </Muted>
            </div>
          </div>
        ) : (
          <UpgradePrompt
            title={t("environments.settings.general.customize_email_with_a_higher_plan")}
            description={t("environments.settings.general.eliminate_branding_with_whitelabel")}
            buttons={buttons}
          />
        )}

        {hasWhiteLabelPermission && isReadOnly && (
          <Alert variant="warning" className="mt-4 mb-6">
            <AlertDescription>
              {t("common.only_owners_managers_and_manage_access_members_can_perform_this_action")}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </SettingsCard>
  );
};
