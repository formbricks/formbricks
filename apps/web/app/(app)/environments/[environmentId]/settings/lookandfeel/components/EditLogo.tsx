"use client";

import { useState } from "react";

import { TProduct } from "@formbricks/types/product";
import FileInput from "@formbricks/ui/FileInput";
import { Label } from "@formbricks/ui/Label";
import { LogoSetting } from "@formbricks/ui/LogoSettingModal/components/LogoSetting";

interface EditBrandColorProps {
  product: TProduct;
  environmentId: string;
  isLogoEditDisabled: boolean;
}

export function EditLogo({ product, environmentId, isLogoEditDisabled }: EditBrandColorProps) {
  const [image, setImage] = useState<string>(product.brand?.logoUrl);
  const [imageUploadFromRegularFileUpload, setImageUploadFromRegularFileUpload] = useState(false);

  return (
    <>
      {!isLogoEditDisabled ? (
        <div className="w-full  items-center">
          {!image && (
            <Label className="" htmlFor="logo">
              Company Logo
            </Label>
          )}
          {!image && (
            <div className="mt-3 w-full ">
              <FileInput
                id="Companylogo-input"
                allowedFileExtensions={["png", "jpeg"]}
                environmentId={environmentId}
                onFileUpload={(url: string[]) => {
                  setImage(url[0]);
                  setImageUploadFromRegularFileUpload(true);
                }}
              />
            </div>
          )}

          {image && (
            <div>
              <LogoSetting
                imageUrl={image}
                environmentId={environmentId}
                product={product}
                fromLookAndFeelSetting={true}
                setImage={setImage}
                imageUploadFromRegularFileUpload={imageUploadFromRegularFileUpload}
                fromEditLogo={true}
              />
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-red-700">
          Only Owners, Admins, Developers, and Editors can perform this action.
        </p>
      )}
    </>
  );
}
