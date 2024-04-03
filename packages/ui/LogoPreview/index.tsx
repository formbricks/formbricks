"use client";

import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { TMembershipRole } from "@formbricks/types/memberships";
import { TProduct } from "@formbricks/types/product";
import { TSurvey } from "@formbricks/types/surveys";

interface LogoPreviewProps {
  environmentId: string;
  product: TProduct;
  survey: TSurvey;
  membershipRole?: TMembershipRole;
}

export const LogoPreview: React.FC<LogoPreviewProps> = ({
  environmentId,
  product,
  survey,
  membershipRole,
}) => {
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

  interface WrapperProps {
    children: React.ReactNode;
  }

  const Wrapper: React.FC<WrapperProps> = ({ children }) => {
    return membershipRole !== "viewer" ? (
      <Link target="_blank" href={`/environments/${environmentId}/settings/lookandfeel#Logo`}>
        {children}
      </Link>
    ) : (
      <div>{children}</div>
    );
  };

  // This function decides the content based on product.brand.logoUrl
  const LogoContent = () =>
    !product?.brand?.logoUrl ? (
      <div className="flex items-center rounded-md border border-dashed border-slate-300 border-opacity-50 bg-slate-100 bg-opacity-50 px-6 py-2 text-xs text-slate-500  hover:cursor-pointer hover:bg-opacity-65">
        Add logo {membershipRole !== "viewer" && <ArrowUpRight strokeWidth={1.5} className="h-4 w-4" />}
      </div>
    ) : (
      <div
        style={{ backgroundColor: product?.brand?.bgColor }}
        className={`absolute rounded-lg border border-transparent  ${membershipRole !== "viewer" && "transition-all duration-200 ease-in-out hover:border-slate-300"}`}>
        <Image
          src={product?.brand?.logoUrl}
          alt="Company Logo"
          className="peer max-h-16 w-auto max-w-40 cursor-pointer rounded-lg object-contain p-1"
          width={256}
          height={56}
        />
        {membershipRole !== "viewer" && (
          <div className="absolute right-2 top-2 h-6 w-6 rounded-md border border-slate-100 bg-slate-50 bg-opacity-90 p-0.5 text-slate-700 opacity-0 transition-all ease-in-out hover:cursor-pointer hover:opacity-100 peer-hover:opacity-100">
            <ArrowUpRight className="h-full w-full" />
          </div>
        )}
      </div>
    );

  return (
    <>
      {!getStyling().hideLogo && (
        <Wrapper>
          <LogoContent />
        </Wrapper>
      )}
    </>
  );
};
