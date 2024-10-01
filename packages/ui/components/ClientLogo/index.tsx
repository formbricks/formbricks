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
      className={cn(previewSurvey ? "" : "left-3 top-3 md:left-7 md:top-7", "group absolute z-0 rounded-lg")}
      style={{ backgroundColor: product.logo?.bgColor }}>
      {previewSurvey && environmentId && (
        <Link
          href={`/environments/${environmentId}/product/look`}
          className="group/link absolute h-full w-full hover:cursor-pointer"
          target="_blank">
          <ArrowUpRight
            size={24}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transform rounded-md bg-white/80 p-0.5 text-slate-700 opacity-0 transition-all duration-200 ease-in-out group-hover/link:opacity-100"
          />
        </Link>
      )}
      {product.logo?.url ? (
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
      ) : (
        <Link
          href={`/environments/${environmentId}/product/look`}
          onClick={(e) => {
            if (!environmentId) {
              e.preventDefault();
            }
          }}
          className="whitespace-nowrap rounded-md border border-dashed border-slate-400 bg-slate-200 px-6 py-3 text-xs text-slate-900 opacity-50 backdrop-blur-sm hover:cursor-pointer hover:border-slate-600"
          target="_blank">
          Add logo
        </Link>
      )}
    </div>
  );
};
