"use client";

import { DownloadIcon } from "lucide-react";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { getSignatureResponseView } from "@/modules/storage/signature-image";
import { Button } from "@/modules/ui/components/button";

interface SignatureResponseProps {
  value: unknown;
  /** `thumbnail` for table cells and lists, `full` for the single response card. */
  variant: "thumbnail" | "full";
}

// The signature is always a 900x300 PNG, so the 3:1 box never crops it.
const THUMBNAIL_SIZE = { width: 96, height: 32 };
const FULL_SIZE = { width: 900, height: 300 };

export const SignatureResponse = ({ value, variant }: Readonly<SignatureResponseProps>) => {
  const { t } = useTranslation();
  const view = getSignatureResponseView(
    value,
    typeof window === "undefined" ? undefined : window.location.origin
  );

  if (view.kind === "skipped") {
    return <div className="font-semibold text-slate-500">{t("common.skipped")}</div>;
  }

  if (view.kind === "text") {
    return <p className="ph-no-capture my-1 truncate font-normal text-slate-700">{view.text}</p>;
  }

  const size = variant === "thumbnail" ? THUMBNAIL_SIZE : FULL_SIZE;

  // `unoptimized`: the storage URL is same-origin and needs the session cookie, which the image optimiser's
  // server-side fetch would not carry.
  const image = (
    <Image
      src={view.src}
      alt={t("common.signature")}
      width={size.width}
      height={size.height}
      unoptimized
      className={cn(
        "rounded-md border border-slate-200 bg-white object-contain",
        variant === "thumbnail" ? "h-8 w-24" : "aspect-[3/1] h-auto w-full"
      )}
    />
  );

  if (variant === "thumbnail") {
    return (
      <a
        href={view.src}
        target="_blank"
        rel="noopener noreferrer"
        className="my-1 inline-block shrink-0 rounded-md focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none"
        data-testid="signature-response-thumbnail">
        {image}
      </a>
    );
  }

  return (
    <div className="my-1 flex w-full max-w-lg flex-col items-start gap-2" data-testid="signature-response">
      <a
        href={view.src}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full rounded-md focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none">
        {image}
      </a>
      <Button asChild variant="outline" size="sm">
        <a href={view.src} download={view.fileName}>
          <DownloadIcon />
          {t("common.download_png")}
        </a>
      </Button>
    </div>
  );
};
