"use client";

import { handleFileUpload } from "@/app/lib/fileUpload";
import Image from "next/image";
import { ChangeEvent, useRef, useState } from "react";
import toast from "react-hot-toast";

import { TProduct, TProductUpdateInput } from "@formbricks/types/product";
import { AdvancedOptionToggle } from "@formbricks/ui/AdvancedOptionToggle";
import { Button } from "@formbricks/ui/Button";
import { ColorPicker } from "@formbricks/ui/ColorPicker";
import FileInput from "@formbricks/ui/FileInput";
import { Input } from "@formbricks/ui/Input";

import { updateProductAction } from "../actions";

interface EditLogoProps {
  product: TProduct;
  environmentId: string;
  isViewer: boolean;
}

export const EditLogo = ({ product, environmentId, isViewer }: EditLogoProps) => {
  const [logoUrl, setLogoUrl] = useState<string | undefined>(product.logo?.url || undefined);
  const [logoBgColor, setLogoBgColor] = useState<string | undefined>(product.logo?.bgColor || undefined);
  const [isBgColorEnabled, setIsBgColorEnabled] = useState<boolean>(!!product.logo?.bgColor);
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
      toast.error("Logo upload failed. Please try again.");
    } finally {
      setIsLoading(false);
      if (!isEditing) {
        setIsEditing(true);
      }
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) await handleImageUpload(file);
  };

  const saveChanges = async () => {
    if (!isEditing) {
      setIsEditing(true);
      return;
    }

    setIsLoading(true);
    try {
      const updatedProduct: Partial<TProductUpdateInput> = {
        logo: { url: logoUrl, bgColor: isBgColorEnabled ? logoBgColor : undefined },
      };
      await updateProductAction(product.id, updatedProduct);
      toast.success("Logo updated successfully");
    } catch (error) {
      toast.error("Failed to update the logo");
    } finally {
      setIsEditing(false);
      setIsLoading(false);
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
    <div className="w-full space-y-8">
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
          allowedFileExtensions={["png", "jpeg", "jpg"]}
          environmentId={environmentId}
          onFileUpload={(files: string[]) => setLogoUrl(files[0])}
        />
      )}

      <Input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      {isEditing && logoUrl && (
        <>
          <div className="flex gap-2">
            <Button onClick={() => fileInputRef.current?.click()} variant="secondary" size="sm">
              Replace Logo
            </Button>
            <Button variant="warn" size="sm" onClick={() => setLogoUrl(undefined)} disabled={!isEditing}>
              Remove Logo
            </Button>
          </div>
          <AdvancedOptionToggle
            isChecked={isBgColorEnabled}
            onToggle={toggleBackgroundColor}
            htmlId="addBackgroundColor"
            title="Add background color"
            description="Add a background color to the logo container."
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
        <Button onClick={saveChanges} disabled={isLoading || isViewer} variant="darkCTA">
          {isEditing ? "Save" : "Edit"}
        </Button>
      )}
    </div>
  );
};
