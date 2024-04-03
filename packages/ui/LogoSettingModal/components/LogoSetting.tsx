"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import toast from "react-hot-toast";

import { TProduct, TProductUpdateInput } from "@formbricks/types/product";

import { handleFileUpload } from "../../../../apps/web/app/(app)/environments/[environmentId]/settings/profile/lib";
import { AdvancedOptionToggle } from "../../AdvancedOptionToggle";
import { Button } from "../../Button";
import { ColorPicker } from "../../ColorPicker";
import FileInput from "../../FileInput";
import { Input } from "../../Input";
import { updateProductAction } from "../actions";

interface LogoChangeEvent extends React.ChangeEvent<HTMLInputElement> {
  target: HTMLInputElement & EventTarget;
}
interface LogoSettingProps {
  imageUrl: string;
  environmentId: string;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  setImage?: React.Dispatch<React.SetStateAction<string>>;
  product: TProduct;
  fromLookAndFeelSetting?: boolean;
  imageUploadFromRegularFileUpload?: boolean;
  setLocalProduct?: React.Dispatch<React.SetStateAction<TProduct>>;
  setImageUrlFromLogoButton?: React.Dispatch<React.SetStateAction<string>>;
  setIsImageAddedFromLogoPreview?: React.Dispatch<React.SetStateAction<boolean>>;
  fromEditLogo?: boolean;
}
export const LogoSetting: React.FC<LogoSettingProps> = ({
  imageUrl,
  environmentId,
  setOpen,
  product,
  fromLookAndFeelSetting = false,
  setImage,
  imageUploadFromRegularFileUpload,
  setLocalProduct,
  setImageUrlFromLogoButton,
  setIsImageAddedFromLogoPreview,
  fromEditLogo,
}) => {
  const [backgroundColor, setBackgroundColor] = useState(product?.brand?.bgColor);
  const [isLoading, setIsLoading] = useState(false);
  const [isStandardFileUploadOpen, setIsStandardFileUploadOpen] = useState(false);
  const [replacedLogo, setReplacedLogo] = useState<string>(imageUrl);
  const [isEdit, setIsEdit] = useState(imageUploadFromRegularFileUpload);
  const replaceLogoRef = useRef<HTMLInputElement>(null);
  const [addBackgroundColor, setAddBackgroundColor] = useState(
    product?.brand?.bgColor.length > 1 ? true : false
  );
  const onchangeImageHandler = async (e: LogoChangeEvent) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleUpload(file, environmentId);
    }
  };
  const handleUpload = async (file: File, environmentId: string) => {
    setIsLoading(true);
    try {
      const { url, error } = await handleFileUpload(file, environmentId);

      if (error) {
        toast.error(error);
        return;
      }

      setReplacedLogo(url);

      setIsStandardFileUploadOpen(false);
    } catch (err) {
      toast.error("Logo upload failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (fromEditLogo) {
        let inputProduct: Partial<TProductUpdateInput> = {
          brand: { logoUrl: replacedLogo, bgColor: backgroundColor },
        };
        await updateProductAction(product.id, inputProduct);
      }
      setLocalProduct &&
        setLocalProduct({
          ...product,
          brand: { logoUrl: replacedLogo, bgColor: backgroundColor },
        });
      setIsImageAddedFromLogoPreview && setIsImageAddedFromLogoPreview(true);
      setImage && setImage(replacedLogo);

      setImageUrlFromLogoButton && setImageUrlFromLogoButton(replacedLogo);
      toast.success("Logo uploaded successfully.");
    } catch (error) {
      if (error instanceof Error) {
        toast.error(`Error: ${error.message}`);
      } else {
        throw error;
      }
    }
  };

  const toggleaddBackgroundColor = (checked: boolean) => {
    if (!checked) {
      setBackgroundColor("");
    } else {
      setBackgroundColor("#ffffff");
    }
    setAddBackgroundColor(checked);
  };

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="text-sm font-semibold text-slate-700">Preview</div>
        {!isStandardFileUploadOpen ? (
          <div>
            <Image
              src={`${replacedLogo ? replacedLogo : imageUrl}`}
              alt="logo"
              style={{ backgroundColor: backgroundColor }}
              className="h-20 w-auto max-w-64 rounded-lg border object-contain p-1 "
              width={256}
              height={56}
            />
          </div>
        ) : (
          <FileInput
            id="Companylogo-input"
            allowedFileExtensions={["png", "jpeg", "jpg"]}
            environmentId={environmentId}
            onFileUpload={(url: string[] | undefined) => {
              if (url && url.length > 0) {
                setReplacedLogo(url[0]);
                setIsStandardFileUploadOpen(false);
              }
            }}
          />
        )}
        {!isStandardFileUploadOpen && (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                if (replaceLogoRef.current) {
                  replaceLogoRef.current.click();
                }
              }}
              disabled={isLoading || !isEdit}>
              Replace logo
            </Button>
            <Input
              ref={replaceLogoRef}
              className="hidden"
              type="file"
              accept="image/*"
              onChange={(e) => onchangeImageHandler(e)}
            />
            <Button
              variant="minimal"
              onClick={() => {
                setIsStandardFileUploadOpen(true);
                setReplacedLogo("");
              }}
              disabled={!isEdit}>
              Remove logo
            </Button>
          </div>
        )}
      </div>

      <AdvancedOptionToggle
        isChecked={addBackgroundColor}
        onToggle={(checked) => toggleaddBackgroundColor(checked)}
        htmlId="addBackgroundColor"
        title="Add background color"
        description="Add a background color to the logo container."
        childBorder
        customContainerClass="p-0"
        disabled={!isEdit}>
        <div className="px-2">
          <ColorPicker color={backgroundColor} onChange={setBackgroundColor} disabled={!isEdit} />
        </div>
      </AdvancedOptionToggle>

      <div className="flex gap-2">
        {(isEdit || !fromLookAndFeelSetting) && (
          <Button
            variant="minimal"
            onClick={() => {
              setReplacedLogo(imageUrl);
              setBackgroundColor(product?.brand?.bgColor);
              setOpen && setOpen(false);
              setImage && setImage(product?.brand?.logoUrl);
              setIsStandardFileUploadOpen(false);
              setIsEdit(false);
            }}>
            Cancel
          </Button>
        )}
        <Button
          variant="darkCTA"
          onClick={() => {
            (isEdit || !fromLookAndFeelSetting) && handleSave();
            setOpen && setOpen(false);
            setIsEdit(!isEdit);
          }}
          disabled={isLoading}>
          {!fromLookAndFeelSetting || isEdit ? "Save" : "Edit"}
        </Button>
      </div>
    </div>
  );
};
