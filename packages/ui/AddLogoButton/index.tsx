"use client";

import { Pencil } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import toast from "react-hot-toast";

import { TMembershipRole } from "@formbricks/types/memberships";
import { TProduct } from "@formbricks/types/product";
import { TSurvey } from "@formbricks/types/surveys";

import { handleFileUpload } from "../../../apps/web/app/(app)/environments/[environmentId]/settings/profile/lib";
import { Input } from "../Input";
import { Label } from "../Label";
import LoadingSpinner from "../LoadingSpinner";
import { LogoSettingModal } from "../LogoSettingModal";

interface AddLogoButtonProps {
  environmentId: string;
  product: TProduct;
  type?: string;
  membershipRole?: TMembershipRole;
  setLocalProduct?: React.Dispatch<React.SetStateAction<TProduct>>;
  survey: TSurvey;
  setIsImageAddedFromAddLogoButton?: React.Dispatch<React.SetStateAction<boolean>>;
}
interface LogoChangeEvent extends React.ChangeEvent<HTMLInputElement> {
  target: HTMLInputElement & EventTarget;
}

export const AddLogoButton: React.FC<AddLogoButtonProps> = ({
  environmentId,
  product,
  type,
  membershipRole,
  setLocalProduct,
  survey,
  setIsImageAddedFromAddLogoButton,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>(product?.brand?.logoUrl);
  const [isLogoAddEditorOpen, setIsLogoAddEditorOpen] = useState(false);

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

  const getStyling = () => {
    // allow style overwrite is disabled from the product
    if (!product.styling.allowStyleOverwrite) {
      return product.styling;
    }

    // allow style overwrite is enabled from the product
    if (product.styling.allowStyleOverwrite) {
      // survey style overwrite is disabled
      if (!survey.styling?.overwriteThemeStyling) {
        return product.styling;
      }

      // survey style overwrite is enabled
      return survey.styling;
    }

    return product.styling;
  };

  return (
    <>
      {membershipRole !== "viewer" && !getStyling().hideLogo && (
        <>
          {isLoading && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <LoadingSpinner />
            </div>
          )}
          {!product?.brand?.logoUrl ? (
            <Label
              htmlFor="addCompanyLogo"
              className={`${type === "mobile" ? "px-6 py-2" : "px-10 py-4"} rounded-md border border-dashed border-slate-300 bg-slate-100 text-xs text-slate-500  hover:cursor-pointer hover:bg-slate-200/25`}>
              Add logo here
              <Input
                id="addCompanyLogo"
                className="hidden"
                type="file"
                accept="image/jpeg,image/png"
                onChange={(e) => onchangeImageHandler(e)}
              />
            </Label>
          ) : (
            <div
              style={{ backgroundColor: product?.brand?.bgColor }}
              className="absolute rounded-lg border border-transparent hover:border-slate-300"
              onClick={() => setIsLogoAddEditorOpen(true)}>
              <Image
                src={product?.brand?.logoUrl}
                alt="Company Logo"
                className={`${type === "mobile" ? "h-12" : "h-16"} peer max-h-16 w-auto max-w-40 cursor-pointer rounded-lg object-contain p-1`}
                width={256}
                height={56}
              />
              <div className="absolute right-2 top-2 hidden h-6 w-6 rounded-md border border-slate-100 bg-slate-50 bg-opacity-90 p-0.5 text-slate-700 transition-all ease-in-out hover:block hover:cursor-pointer peer-hover:block">
                <Pencil className="h-full w-full" />
              </div>
            </div>
          )}

          <LogoSettingModal
            open={isLogoAddEditorOpen}
            setOpen={setIsLogoAddEditorOpen}
            imageUrl={imageUrl}
            setImageUrlFromLogoButton={setImageUrl}
            environmentId={environmentId}
            product={product}
            setLocalProduct={setLocalProduct}
            setIsImageAddedFromAddLogoButton={setIsImageAddedFromAddLogoButton}
          />
        </>
      )}
    </>
  );
};
