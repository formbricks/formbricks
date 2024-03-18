"use client";

import { Pencil } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import toast from "react-hot-toast";

import { TMembershipRole } from "@formbricks/types/memberships";
import { TProduct } from "@formbricks/types/product";
import { TSurvey } from "@formbricks/types/surveys";

import { Input } from "../Input";
import { Label } from "../Label";
import { LogoSettingModal } from "../LogoSettingModal";
import { uploadLogo } from "./lib/uploadLogo";

interface Props {
  environmentId: string;
  product: TProduct;
  type?: string;
  membershipRole?: TMembershipRole;
  setLocalProduct?: React.Dispatch<React.SetStateAction<TProduct>>;
  survey: TSurvey;
}
interface ChangeEvent extends React.ChangeEvent<HTMLInputElement> {
  target: HTMLInputElement & EventTarget;
}

export const AddLogoButton: React.FC<Props> = ({
  environmentId,
  product,
  type,
  membershipRole,
  setLocalProduct,
  survey,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>(product?.brand?.logoUrl);
  const [isLogoAddEditorOpen, setIsLogoAddEditorOpen] = useState(false);

  const onchangeImageHandler = async (e: ChangeEvent) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleUpload(file, environmentId);
    }
  };

  const handleUpload = async (file: File, environmentId: string) => {
    setIsLoading(true);
    try {
      const { url, error } = await uploadLogo(file, environmentId);

      if (error) {
        toast.error(error);
        setIsLoading(false);
        return;
      }

      setImageUrl(url);
    } catch (err) {
      toast.error("Logo upload failed. Please try again.");
      setIsLoading(false);
    }

    setIsLoading(false);
    setIsLogoAddEditorOpen(true);
  };

  return (
    <>
      {membershipRole !== "viewer" && survey.styling?.showLogo && (
        <>
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
          {!product?.brand?.logoUrl && (
            <Label
              htmlFor="addCompanyLogo"
              className={`${type === "mobile" ? "px-6 py-2" : "px-8 py-3"} rounded-lg border-[3px] border-dashed border-slate-300 bg-slate-100  hover:cursor-pointer hover:bg-slate-200`}>
              Add logo here
              <Input
                id="addCompanyLogo"
                className="hidden"
                type="file"
                accept="image/jpeg,image/png"
                onChange={(e) => onchangeImageHandler(e)}
              />
            </Label>
          )}
          {product?.brand?.logoUrl && (
            <div className="relative">
              <div
                 style={{ backgroundColor: product?.brand?.bgColor }}
                className=" absolute rounded-lg border border-transparent hover:border-slate-300"
                onClick={() => setIsLogoAddEditorOpen(true)}>
                <Image
                  src={product?.brand?.logoUrl}
                  alt="Company Logo"
                  className={`${type === "mobile" ? "h-12" : "h-14"} peer w-auto max-w-64 cursor-pointer rounded-lg object-contain p-1`}
                  width={256}
                  height={56}
                />
                <div className="absolute  right-0 top-0 hidden peer-hover:block">
                  <Pencil className="m-1 h-4 w-4 rounded-[0.3rem] bg-slate-200" />
                </div>
              </div>
            </div>
          )}
          <LogoSettingModal
            open={isLogoAddEditorOpen}
            setOpen={setIsLogoAddEditorOpen}
            imageUrl={imageUrl}
            setImageUrl={setImageUrl}
            environmentId={environmentId}
            product={product}
            setLocalProduct={setLocalProduct}
          />
        </>
      )}
    </>
  );
};
