"use client";

import { ConfirmPasswordForm } from "@/modules/ee/two-factor-auth/components/confirm-password-form";
import { DisplayBackupCodes } from "@/modules/ee/two-factor-auth/components/display-backup-codes";
import { EnterCode } from "@/modules/ee/two-factor-auth/components/enter-code";
import { ScanQRCode } from "@/modules/ee/two-factor-auth/components/scan-qr-code";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { useTranslate } from "@tolgee/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type EnableTwoFactorModalStep = "confirmPassword" | "scanQRCode" | "enterCode" | "backupCodes";

interface EnableTwoFactorModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const EnableTwoFactorModal = ({ open, setOpen }: EnableTwoFactorModalProps) => {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<EnableTwoFactorModalStep>("confirmPassword");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [dataUri, setDataUri] = useState<string>("");
  const [secret, setSecret] = useState<string>("");

  const refreshData = () => {
    router.refresh();
  };

  const { t } = useTranslate();

  const resetState = () => {
    setCurrentStep("confirmPassword");
    setBackupCodes([]);
    setDataUri("");
    setSecret("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={() => resetState()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("environments.settings.profile.two_factor_authentication")}</DialogTitle>
          <DialogDescription>
            {t("environments.settings.profile.confirm_your_current_password_to_get_started")}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {currentStep === "confirmPassword" && (
            <ConfirmPasswordForm
              setBackupCodes={setBackupCodes}
              setCurrentStep={setCurrentStep}
              setDataUri={setDataUri}
              setSecret={setSecret}
              setOpen={setOpen}
            />
          )}

          {currentStep === "scanQRCode" && (
            <ScanQRCode setCurrentStep={setCurrentStep} dataUri={dataUri} secret={secret} setOpen={setOpen} />
          )}

          {currentStep === "enterCode" && (
            <EnterCode setCurrentStep={setCurrentStep} setOpen={setOpen} refreshData={refreshData} />
          )}

          {currentStep === "backupCodes" && (
            <DisplayBackupCodes backupCodes={backupCodes} setOpen={resetState} />
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};
