"use client";

import { Button } from "@/modules/ui/components/button";
import { useTranslate } from "@tolgee/react";
import { CopyIcon } from "lucide-react";
import Image from "next/image";
import { toast } from "react-hot-toast";
import { EnableTwoFactorModalStep } from "./enable-two-factor-modal";

interface ScanQRCodeProps {
  setCurrentStep: (step: EnableTwoFactorModalStep) => void;
  dataUri: string;
  secret: string;
  setOpen: (open: boolean) => void;
}

export const ScanQRCode = ({ dataUri, secret, setCurrentStep, setOpen }: ScanQRCodeProps) => {
  const { t } = useTranslate();
  return (
    <div>
      <div className="p-6">
        <h1 className="text-lg font-semibold">
          {t("environments.settings.profile.enable_two_factor_authentication")}
        </h1>
        <h3 className="text-sm text-slate-700">
          {t("environments.settings.profile.scan_the_qr_code_below_with_your_authenticator_app")}
        </h3>
      </div>

      <div className="mb-4 flex flex-col items-center justify-center space-y-4">
        <Image src={dataUri} alt="QR code" width={200} height={200} />
        <p className="text-sm text-slate-700">
          {t("environments.settings.profile.or_enter_the_following_code_manually")}
        </p>
        <div className="flex items-center space-x-2">
          <p className="text-sm font-medium text-slate-700">{secret}</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(secret).then(() => {
                toast.success(t("common.copied_to_clipboard"));
              });
            }}>
            <CopyIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex w-full items-center justify-end space-x-4 border-t border-slate-300 p-4">
        <Button variant="secondary" size="sm" type="button" onClick={() => setOpen(false)}>
          {t("common.cancel")}
        </Button>

        <Button size="sm" onClick={() => setCurrentStep("enterCode")}>
          {t("common.next")}
        </Button>
      </div>
    </div>
  );
};
