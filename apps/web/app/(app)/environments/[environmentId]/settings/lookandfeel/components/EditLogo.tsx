"use client";

import Image from "next/image";
import { ChangeEvent, useRef, useState } from "react";
import toast from "react-hot-toast";

import { TProduct, TProductUpdateInput } from "@formbricks/types/product";
import { AdvancedOptionToggle } from "@formbricks/ui/AdvancedOptionToggle";
import { Button } from "@formbricks/ui/Button";
import { ColorPicker } from "@formbricks/ui/ColorPicker";
import FileInput from "@formbricks/ui/FileInput";
import { Input } from "@formbricks/ui/Input";

import { handleFileUpload } from "../..//profile/lib";
import { updateProductAction } from "../actions";

interface EditLogoProps {
  product: TProduct;
  environmentId: string;
  isLogoEditDisabled: boolean;
}

export const EditLogo = ({ product, environmentId, isLogoEditDisabled }: EditLogoProps) => {
  const [logoUrl, setLogoUrl] = useState(product.brand?.logoUrl || "");
  const [backgroundColor, setBackgroundColor] = useState(product.brand?.bgColor || "");
  const [addBackgroundColor, setAddBackgroundColor] = useState(
    product?.brand?.bgColor.length > 1 ? true : false
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (file: File) => {
    setIsLoading(true);
    try {
      const uploadResult = await handleFileUpload(file, environmentId);
      if (uploadResult.error) {
        toast.error(uploadResult.error);
      } else {
        setLogoUrl(uploadResult.url);
      }
    } catch (error) {
      toast.error("Logo upload failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) await handleImageUpload(file);
  };

  const saveChanges = async () => {
    if (!isEditing) return setIsEditing(true);

    setIsLoading(true);
    try {
      await updateProductAction(product.id, {
        brand: { logoUrl: logoUrl, bgColor: backgroundColor },
      } as Partial<TProductUpdateInput>);
      toast.success("Logo updated successfully");
    } catch (error) {
      toast.error("Failed to update the logo");
    } finally {
      setIsEditing(false);
      setIsLoading(false);
    }
  };

  if (isLogoEditDisabled) {
    return <p className="text-sm text-red-700">You do not have permission to edit this logo.</p>;
  }

  const toggleaddBackgroundColor = (checked: boolean) => {
    if (!checked) {
      setBackgroundColor("");
    } else {
      setBackgroundColor("#ffffff");
    }
    setAddBackgroundColor(checked);
  };

  return (
    <div className="w-full space-y-8">
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt="Logo"
          width={256}
          height={56}
          style={{ backgroundColor: backgroundColor }}
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
            <Button
              variant="warn"
              size="sm"
              onClick={() => {
                setLogoUrl("");
              }}
              disabled={!isEditing}>
              Remove logo
            </Button>
          </div>
          <AdvancedOptionToggle
            isChecked={addBackgroundColor}
            onToggle={(checked) => toggleaddBackgroundColor(checked)}
            htmlId="addBackgroundColor"
            title="Add background color"
            description="Add a background color to the logo container."
            childBorder
            customContainerClass="p-0"
            disabled={!isEditing}>
            <div className="px-2">
              <ColorPicker color={backgroundColor} onChange={setBackgroundColor} disabled={!isEditing} />
            </div>
          </AdvancedOptionToggle>
        </>
      )}

      {logoUrl && (
        <Button onClick={saveChanges} disabled={isLoading} variant="darkCTA" className="mt-2">
          {isEditing ? "Save" : "Edit"}
        </Button>
      )}
    </div>
  );
};
