"use client";

import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import {
  removeOrganizationEmailLogoUrlAction,
  updateOrganizationEmailLogoUrlAction,
} from "@/modules/ee/whitelabel/email-customization/actions";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { Uploader } from "@/modules/ui/components/file-input/components/uploader";
import { uploadFile } from "@/modules/ui/components/file-input/lib/utils";
import { P } from "@/modules/ui/components/typography";
import { ModalButton, UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";
import { RepeatIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { cn } from "@formbricks/lib/cn";
import { TAllowedFileExtension } from "@formbricks/types/common";
import { TOrganization } from "@formbricks/types/organizations";

const allowedFileExtensions: TAllowedFileExtension[] = ["jpeg", "png", "jpg", "webp"];
const DEFAULT_LOGO_URL =
  "https://s3.eu-central-1.amazonaws.com/listmonk-formbricks/Formbricks-Light-transparent.png";

interface EmailCustomizationSettingsProps {
  organization: TOrganization;
  hasWhiteLabelPermission: boolean;
  environmentId: string;
  isReadOnly: boolean;
  isFormbricksCloud: boolean;
}

export const EmailCustomizationSettings = ({
  organization,
  hasWhiteLabelPermission,
  environmentId,
  isReadOnly,
  isFormbricksCloud,
}: EmailCustomizationSettingsProps) => {
  const t = useTranslations();

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState<string>(organization.whitelabel?.logoUrl || DEFAULT_LOGO_URL);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isDefaultLogo = logoUrl === DEFAULT_LOGO_URL;

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

    if (isDefaultLogo) return;

    const removeLogoResponse = await removeOrganizationEmailLogoUrlAction({
      organizationId: organization.id,
    });

    if (removeLogoResponse?.data) {
      toast.success(t("common.removed"));
    } else {
      const errorMessage = getFormattedErrorMessage(removeLogoResponse);
      toast.error(errorMessage);
    }
  };

  const buttons: [ModalButton, ModalButton] = [
    {
      text: t("common.start_free_trial"),
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

  const handleSave = async () => {
    if (!logoFile) return;
    setIsSaving(true);
    const { url } = await uploadFile(logoFile, allowedFileExtensions, environmentId);
    const updateLogoResponse = await updateOrganizationEmailLogoUrlAction({
      organizationId: organization.id,
      logoUrl: url,
    });

    if (updateLogoResponse?.data) {
      toast.success(t("common.saved"));
    } else {
      const errorMessage = getFormattedErrorMessage(updateLogoResponse);
      toast.error(errorMessage);
    }

    setIsSaving(false);
  };

  return (
    <SettingsCard
      className="pb-0"
      title={t("environments.project.look.email_customization")}
      description={t("environments.project.look.email_customization_description")}
      noPadding>
      <div className="px-6 pt-6">
        {hasWhiteLabelPermission ? (
          <div>
            <P>Logo in header</P>

            <div className="mb-6 mt-2 flex items-center gap-4">
              {logoUrl && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-center rounded-lg border border-slate-200 p-2">
                    <Image
                      src={logoUrl}
                      alt="Logo"
                      className="max-h-24 max-w-full object-contain"
                      width={192}
                      height={192}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={() => inputRef.current?.click()}>
                      <RepeatIcon className="h-4 w-4" />
                      Replace logo
                    </Button>
                    <Button onClick={removeLogo} variant="outline">
                      <Trash2Icon className="h-4 w-4" />
                      Remove logo
                    </Button>
                  </div>
                </div>
              )}
              <Uploader
                ref={inputRef}
                allowedFileExtensions={[...allowedFileExtensions]}
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
              <Button variant="secondary">Send test email</Button>
              <Button onClick={handleSave} disabled={!logoFile} loading={isSaving}>
                Save
              </Button>
            </div>
          </div>
        ) : (
          <UpgradePrompt
            title={t("environments.project.look.customize_email_with_a_higher_plan")}
            description={t("environments.project.look.eliminate_branding_with_whitelabel")}
            buttons={buttons}
          />
        )}

        {hasWhiteLabelPermission && isReadOnly && (
          <Alert variant="warning" className="mt-4">
            <AlertDescription>
              {t("common.only_owners_managers_and_manage_access_members_can_perform_this_action")}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </SettingsCard>
  );
};
