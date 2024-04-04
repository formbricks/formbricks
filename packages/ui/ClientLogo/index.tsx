"use client";

import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { cn } from "@formbricks/lib/cn";
import { TProduct } from "@formbricks/types/product";

interface ClientLogoProps {
  environmentId?: string;
  product: TProduct;
  previewSurvey?: boolean;
}

export const ClientLogo = ({ environmentId, product, previewSurvey = false }: ClientLogoProps) => {
  return (
    <div
      className={cn(previewSurvey ? "" : "left-5 top-5 md:left-7 md:top-7", "group absolute z-0 rounded-lg")}
      style={{ backgroundColor: product.logo?.bgColor }}>
      {previewSurvey && environmentId && (
        <Link
          href={`/environments/${environmentId}/settings/lookandfeel`}
          className="group/link absolute h-full w-full rounded-md"
          target="_blank">
          <ArrowUpRight
            size={24}
            className="absolute right-1 top-1 rounded-md bg-white/80 p-0.5 text-slate-700 opacity-0 transition-all duration-200 ease-in-out group-hover/link:opacity-100"
          />
        </Link>
      )}
      {product.logo?.url && (
        <Image
          src={product.logo?.url}
          className={cn(
            previewSurvey ? "max-h-12" : "max-h-16 md:max-h-20",
            "w-auto max-w-40 rounded-lg object-contain p-1 md:max-w-56"
          )}
          width={256}
          height={64}
          alt="Company Logo"
        />
      )}
    </div>
  );
};
