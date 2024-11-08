"use client";

import { handleFileUpload } from "@/app/lib/fileUpload";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { ChangeEvent, useRef, useState } from "react";
import toast from "react-hot-toast";
import { TProduct, TProductUpdateInput } from "@formbricks/types/product";
import { AdvancedOptionToggle } from "@formbricks/ui/components/AdvancedOptionToggle";
import { Button } from "@formbricks/ui/components/Button";
import { ColorPicker } from "@formbricks/ui/components/ColorPicker";
import { DeleteDialog } from "@formbricks/ui/components/DeleteDialog";
import { FileInput } from "@formbricks/ui/components/FileInput";
import { Input } from "@formbricks/ui/components/Input";
import { updateProductAction } from "../../actions";

interface EditLogoProps {
  product: TProduct;
  environmentId: string;
  isViewer: boolean;
}

export const EditLogo = ({ product, environmentId, isViewer }: EditLogoProps) => {
  const t = useTranslations();
  const [logoUrl, setLogoUrl] = useState<string | undefined>(product.logo?.url || undefined);
  const [logoBgColor, setLogoBgColor] = useState<string | undefined>(product.logo?.bgColor || undefined);
  const [isBgColorEnabled, setIsBgColorEnabled] = useState<boolean>(!!product.logo?.bgColor);
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
      toast.error(t("environments.product.look.logo_upload_failed"));
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
      const updatedProduct: TProductUpdateInput = {
        logo: { url: logoUrl, bgColor: isBgColorEnabled ? logoBgColor : undefined },
      };
      await updateProductAction({ productId: product.id, data: updatedProduct });
      toast.success(t("environments.product.look.logo_updated_successfully"));
    } catch (error) {
      toast.error(t("environments.product.look.failed_to_update_logo"));
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
      const updatedProduct: TProductUpdateInput = {
        logo: { url: undefined, bgColor: undefined },
      };
      await updateProductAction({ productId: product.id, data: updatedProduct });
      toast.success(t("environments.product.look.logo_removed_successfully"));
    } catch (error) {
      toast.error(t("environments.product.look.failed_to_remove_logo"));
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
          allowedFileExtensions={["png", "jpeg", "jpg", "webp"]}
          environmentId={environmentId}
          onFileUpload={(files: string[]) => {
            setLogoUrl(files[0]);
            setIsEditing(true);
          }}
        />
      )}

      <Input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg, image/png, image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {isEditing && logoUrl && (
        <>
          <div className="flex gap-2">
            <Button onClick={() => fileInputRef.current?.click()} variant="secondary" size="sm">
              {t("environments.product.look.replace_logo")}
            </Button>
            <Button
              variant="warn"
              size="sm"
              onClick={() => setConfirmRemoveLogoModalOpen(true)}
              disabled={!isEditing}>
              {t("environments.product.look.remove_logo")}
            </Button>
          </div>
          <AdvancedOptionToggle
            isChecked={isBgColorEnabled}
            onToggle={toggleBackgroundColor}
            htmlId="addBackgroundColor"
            title={t("environments.product.look.add_background_color")}
            description={t("environments.product.look.add_background_color_description")}
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
        <Button onClick={saveChanges} disabled={isLoading || isViewer} size="sm">
          {isEditing ? t("common.save") : t("common.edit")}
        </Button>
      )}
      <DeleteDialog
        open={confirmRemoveLogoModalOpen}
        setOpen={setConfirmRemoveLogoModalOpen}
        deleteWhat={t("common.logo")}
        text={t("environments.product.look.remove_logo_confirmation")}
        onDelete={removeLogo}
      />
    </div>
  );
};
