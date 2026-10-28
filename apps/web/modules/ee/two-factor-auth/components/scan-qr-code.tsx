"use client";

import { CopyIcon } from "lucide-react";
import Image from "next/image";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { copyToClipboard } from "@/lib/utils/clipboard";
import { Button } from "@/modules/ui/components/button";
import { EnableTwoFactorModalStep } from "./enable-two-factor-modal";

interface ScanQRCodeProps {
  setCurrentStep: (step: EnableTwoFactorModalStep) => void;
  dataUri: string;
  secret: string;
  setOpen: (open: boolean) => void;
}

export const ScanQRCode = ({ dataUri, secret, setCurrentStep, setOpen }: Readonly<ScanQRCodeProps>) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center justify-center gap-3">
        <Image src={dataUri} alt="QR code" width={200} height={200} />
        <p className="text-slate-600">
          {t("workspace.settings.profile.or_enter_the_following_code_manually")}
        </p>
        <div className="flex max-w-full items-center gap-2">
          <p className="min-w-0 font-medium break-all text-slate-800">{secret}</p>
          <Button
            variant="outline"
            size="icon"
            type="button"
            aria-label={t("common.copy")}
            onClick={async () => {
              if (await copyToClipboard(secret)) {
                toast.success(t("common.copied_to_clipboard"));
              } else {
                toast.error(t("common.failed_to_copy_to_clipboard"));
              }
            }}>
            <CopyIcon />
          </Button>
        </div>
      </div>

      <div className="flex w-full items-center justify-end gap-2">
        <Button variant="outline" type="button" onClick={() => setOpen(false)}>
          {t("common.cancel")}
        </Button>

        <Button onClick={() => setCurrentStep("enterCode")}>{t("common.next")}</Button>
      </div>
    </div>
  );
};
