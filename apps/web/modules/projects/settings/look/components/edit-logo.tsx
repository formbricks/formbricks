"use client";

import { handleFileUpload } from "@/app/lib/fileUpload";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { updateProjectAction } from "@/modules/projects/settings/actions";
import { AdvancedOptionToggle } from "@/modules/ui/components/advanced-option-toggle";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { ColorPicker } from "@/modules/ui/components/color-picker";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { FileInput } from "@/modules/ui/components/file-input";
import { Input } from "@/modules/ui/components/input";
import { Project } from "@prisma/client";
import { useTranslate } from "@tolgee/react";
import Image from "next/image";
import { ChangeEvent, useRef, useState } from "react";
import toast from "react-hot-toast";

interface EditLogoProps {
  project: Project;
  environmentId: string;
  isReadOnly: boolean;
}

export const EditLogo = ({ project, environmentId, isReadOnly }: EditLogoProps) => {
  const { t } = useTranslate();
  const [logoUrl, setLogoUrl] = useState<string | undefined>(project.logo?.url || undefined);
  const [logoBgColor, setLogoBgColor] = useState<string | undefined>(project.logo?.bgColor || undefined);
  const [isBgColorEnabled, setIsBgColorEnabled] = useState<boolean>(!!project.logo?.bgColor);
  const [confirmRemoveLogoModalOpen, setConfirmRemoveLogoModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (file: File) => {
    setIsLoading(true);
    try {
      const uploadResult = await handleFileUpload(file, environmentId);
      if (uploadResult.error) {
        toast.error(uploadResult.error);
        return;
      }
      setLogoUrl(uploadResult.url);
    } catch (error) {
      toast.error(t("environments.project.look.logo_upload_failed"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) await handleImageUpload(file);
    setIsEditing(true);
  };

  const saveChanges = async () => {
    if (!isEditing) {
      setIsEditing(true);
      return;
    }

    setIsLoading(true);
    try {
      const updatedProject: Project["logo"] = {
        logo: { url: logoUrl, bgColor: isBgColorEnabled ? logoBgColor : undefined },
      };
      const updateProjectResponse = await updateProjectAction({
        projectId: project.id,
        data: updatedProject,
      });
      if (updateProjectResponse?.data) {
        toast.success(t("environments.project.look.logo_updated_successfully"));
      } else {
        const errorMessage = getFormattedErrorMessage(updateProjectResponse);
        toast.error(errorMessage);
      }
    } catch (error) {
      toast.error(t("environments.project.look.failed_to_update_logo"));
    } finally {
      setIsEditing(false);
      setIsLoading(false);
    }
  };

  const removeLogo = async () => {
    setLogoUrl(undefined);
    if (!isEditing) {
      setIsEditing(true);
      return;
    }

    setIsLoading(true);
    try {
      const updatedProject: Project["logo"] = {
        logo: { url: undefined, bgColor: undefined },
      };
      const updateProjectResponse = await updateProjectAction({
        projectId: project.id,
        data: updatedProject,
      });
      if (updateProjectResponse?.data) {
        toast.success(t("environments.project.look.logo_removed_successfully"));
      } else {
        const errorMessage = getFormattedErrorMessage(updateProjectResponse);
        toast.error(errorMessage);
      }
    } catch (error) {
      toast.error(t("environments.project.look.failed_to_remove_logo"));
    } finally {
      setIsEditing(false);
      setIsLoading(false);
      setConfirmRemoveLogoModalOpen(false);
    }
  };

  const toggleBackgroundColor = (enabled: boolean) => {
    setIsBgColorEnabled(enabled);
    if (!enabled) {
      setLogoBgColor(undefined);
    } else if (!logoBgColor) {
      setLogoBgColor("#f8f8f8");
    }
  };

  return (
    <>
      <div className="w-full space-y-8" id="edit-logo">
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt="Logo"
            width={256}
            height={56}
            style={{ backgroundColor: logoBgColor || undefined }}
            className="-mb-6 h-20 w-auto max-w-64 rounded-lg border object-contain p-1"
          />
        ) : (
          <FileInput
            id="logo-input"
            allowedFileExtensions={["png", "jpeg", "jpg", "webp", "heic"]}
            environmentId={environmentId}
            onFileUpload={(files: string[]) => {
              setLogoUrl(files[0]);
              setIsEditing(true);
            }}
            disabled={isReadOnly}
          />
        )}

        <Input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg, image/png, image/webp, image/heic"
          className="hidden"
          disabled={isReadOnly}
          onChange={handleFileChange}
        />

        {isEditing && logoUrl && (
          <>
            <div className="flex gap-2">
              <Button onClick={() => fileInputRef.current?.click()} variant="secondary" size="sm">
                {t("environments.project.look.replace_logo")}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmRemoveLogoModalOpen(true)}
                disabled={!isEditing}>
                {t("environments.project.look.remove_logo")}
              </Button>
            </div>
            <AdvancedOptionToggle
              isChecked={isBgColorEnabled}
              onToggle={toggleBackgroundColor}
              htmlId="addBackgroundColor"
              title={t("environments.project.look.add_background_color")}
              description={t("environments.project.look.add_background_color_description")}
              childBorder
              customContainerClass="p-0"
              disabled={!isEditing}>
              {isBgColorEnabled && (
                <div className="px-2">
                  <ColorPicker
                    color={logoBgColor || "#f8f8f8"}
                    onChange={setLogoBgColor}
                    disabled={!isEditing}
                  />
                </div>
              )}
            </AdvancedOptionToggle>
          </>
        )}
        {logoUrl && (
          <Button onClick={saveChanges} disabled={isLoading || isReadOnly} size="sm">
            {isEditing ? t("common.save") : t("common.edit")}
          </Button>
        )}
        <DeleteDialog
          open={confirmRemoveLogoModalOpen}
          setOpen={setConfirmRemoveLogoModalOpen}
          deleteWhat={t("common.logo")}
          text={t("environments.project.look.remove_logo_confirmation")}
          onDelete={removeLogo}
        />
      </div>
      {isReadOnly && (
        <Alert variant="warning" className="mt-4">
          <AlertDescription>
            {t("common.only_owners_managers_and_manage_access_members_can_perform_this_action")}
          </AlertDescription>
        </Alert>
      )}
    </>
  );
};
