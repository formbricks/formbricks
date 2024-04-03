"use client";

import { Palette } from "lucide-react";

import { TProduct } from "@formbricks/types/product";

import { Modal } from "../Modal";
import { LogoSetting } from "./components/LogoSetting";

interface LogoSettingModalProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  imageUrl: string;
  environmentId: string;
  product: TProduct;
  setLocalProduct?: React.Dispatch<React.SetStateAction<TProduct>>;
  setImageUrlFromLogoButton: React.Dispatch<React.SetStateAction<string>>;
  setIsImageAddedFromLogoPreview?: React.Dispatch<React.SetStateAction<boolean>>;
}

export const LogoSettingModal: React.FC<LogoSettingModalProps> = ({
  open,
  setOpen,
  imageUrl,
  environmentId,
  product,
  setImageUrlFromLogoButton,
  setLocalProduct,
  setIsImageAddedFromLogoPreview,
}) => {
  return (
    <Modal open={open} setOpen={setOpen} closeOnOutsideClick={false} size={"md"} noPadding={true}>
      <div className="flex w-full items-center space-x-2 rounded-t-lg bg-slate-100 p-6">
        <div className="mr-1.5 h-6 w-6 text-slate-500">
          <Palette className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xl font-medium text-slate-700">Logo Settings</div>
          <div className="text-sm text-slate-500">Change logo settings for all surveys.</div>
        </div>
      </div>

      <div className="px-4 pb-4 pt-5 sm:p-6">
        <LogoSetting
          imageUrl={imageUrl}
          environmentId={environmentId}
          setOpen={setOpen}
          product={product}
          setLocalProduct={setLocalProduct}
          setImageUrlFromLogoButton={setImageUrlFromLogoButton}
          setIsImageAddedFromLogoPreview={setIsImageAddedFromLogoPreview}
        />
      </div>
    </Modal>
  );
};
