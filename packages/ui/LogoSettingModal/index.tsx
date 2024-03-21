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
  setIsImageAddedInAddLogoButton: React.Dispatch<React.SetStateAction<boolean>>;
}

export const LogoSettingModal: React.FC<LogoSettingModalProps> = ({
  open,
  setOpen,
  imageUrl,
  environmentId,
  product,
  setImageUrlFromLogoButton,
  setLocalProduct,
  setIsImageAddedInAddLogoButton,
}) => {
  return (
    <Modal
      open={open}
      setOpen={setOpen}
      hideCloseButton={true}
      closeOnOutsideClick={false}
      size={"md"}
      noPadding={true}>
      <div className="flex items-center gap-2 rounded-lg bg-slate-100 p-4">
        <Palette className="mx-4 h-10 w-10" />
        <div>
          <div className="text-[1.4rem] font-[450]">Logo Settings ( for all surveys )</div>
          <div className="text-slate-700">Change logo settings for all surveys.</div>
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
          setIsImageAddedInAddLogoButton={setIsImageAddedInAddLogoButton}
        />
      </div>
    </Modal>
  );
};
