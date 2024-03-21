"use client";

import { Label } from "@radix-ui/react-label";
import { MessageCircleWarning } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import toast from "react-hot-toast";

import { TProduct, TProductUpdateInput } from "@formbricks/types/product";

import { handleFileUpload } from "../../../../apps/web/app/(app)/environments/[environmentId]/settings/profile/lib";
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
  setIsImageAddedFromAddLogoButton?: React.Dispatch<React.SetStateAction<boolean>>;
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
  setIsImageAddedFromAddLogoButton,
  fromEditLogo,
}) => {
  const [backgroundColor, setBackgroundColor] = useState(product?.brand?.bgColor || "#ffffff");
  const [isLoading, setIsLoading] = useState(false);
  const [isStandardFileUploadOpen, setIsStandardFileUploadOpen] = useState(false);
  const [replacedLogo, setReplacedLogo] = useState<string>(imageUrl);
  const [isEdit, setIsEdit] = useState(imageUploadFromRegularFileUpload);
  const replaceLogoRef = useRef<HTMLInputElement>(null);

  const backgroundColorChangeHandler = (color: string) => {
    setBackgroundColor(color);
  };
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
      setIsImageAddedFromAddLogoButton && setIsImageAddedFromAddLogoButton(true);
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
  return (
    <>
      <div className="relative">
        {!isEdit && fromLookAndFeelSetting && <div className="absolute z-[999999] h-full w-full"></div>}
        {isLoading && (
          <div className="absolute inset-0 flex  items-center justify-center ">
            <svg className="h-7 w-7 animate-spin text-slate-800" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        )}
        <div className="flex flex-col gap-12">
          <div className="flex  flex-col gap-[0.45rem]">
            <div className="font-[500]">Preview</div>
            <div className={` w-full rounded-lg  border-2 bg-slate-100 `}>
              {!isStandardFileUploadOpen ? (
                <Image
                  src={`${replacedLogo ? replacedLogo : imageUrl}`}
                  alt="logo"
                  style={{ backgroundColor: backgroundColor }}
                  className="m-2 h-20 w-auto  max-w-64 rounded-lg border-2 object-contain p-1 "
                  width={256}
                  height={56}
                />
              ) : (
                <FileInput
                  id="Companylogo-input"
                  allowedFileExtensions={["png", "jpeg"]}
                  environmentId={environmentId}
                  onFileUpload={(url: any) => {
                    setReplacedLogo(url[0]);
                    setIsStandardFileUploadOpen(false);
                  }}
                />
              )}
            </div>
            <div className=" flex gap-4">
              {(isEdit || !fromLookAndFeelSetting) && (
                <>
                  <Button
                    variant="secondary"
                    className="rounded-lg bg-slate-100"
                    onClick={() => {
                      if (replaceLogoRef.current) {
                        replaceLogoRef.current.click();
                      }
                    }}
                    disabled={isLoading}>
                    Replace logo
                  </Button>
                  <Input
                    ref={replaceLogoRef}
                    className="hidden"
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={(e) => onchangeImageHandler(e)}
                  />
                </>
              )}

              {(isEdit || !fromLookAndFeelSetting) && (
                <Button
                  variant="minimal"
                  className="rounded-lg "
                  onClick={() => {
                    setIsStandardFileUploadOpen(true);
                    setReplacedLogo("");
                  }}>
                  Remove logo
                </Button>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="font-[500]">Background Color</div>
            <div className="flex h-28 w-full flex-col justify-center rounded-lg border-2 bg-slate-100 pl-3">
              <div className="w-1/2">
                <Label htmlFor="backgroundColor">Color (HEX)</Label>
                <ColorPicker color={backgroundColor} onChange={backgroundColorChangeHandler} />
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="mt-3 flex items-center gap-1 rounded-lg border-2 bg-slate-50 p-2 text-[0.75rem]">
                <MessageCircleWarning className="w-4" />
                <p>The logo will be updated for all surveys which have the logo setting enabled</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-3 ">
        {(isEdit || !fromLookAndFeelSetting) && (
          <Button
            variant="minimal"
            size="lg"
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
          size="lg"
          onClick={() => {
            (isEdit || !fromLookAndFeelSetting) && handleSave();
            setOpen && setOpen(false);
            setIsEdit(!isEdit);
          }}
          disabled={isLoading}>
          {!fromLookAndFeelSetting || isEdit ? "Save" : "Edit"}
        </Button>
      </div>
    </>
  );
};
