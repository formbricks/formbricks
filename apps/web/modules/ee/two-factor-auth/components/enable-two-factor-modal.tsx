"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
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

export type EnableTwoFactorModalStep = "confirmPassword" | "scanQRCode" | "enterCode" | "backupCodes";

interface EnableTwoFactorModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const EnableTwoFactorModal = ({ open, setOpen }: Readonly<EnableTwoFactorModalProps>) => {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<EnableTwoFactorModalStep>("confirmPassword");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [dataUri, setDataUri] = useState<string>("");
  const [secret, setSecret] = useState<string>("");

  const refreshData = () => {
    router.refresh();
  };

  const { t } = useTranslation();

  const resetState = () => {
    setCurrentStep("confirmPassword");
    setBackupCodes([]);
    setDataUri("");
    setSecret("");
    setOpen(false);
  };

  // Written out per step because `scan-translations` only recognizes literal keys.
  const copy = {
    confirmPassword: {
      title: t("workspace.settings.profile.two_factor_authentication"),
      description: t("workspace.settings.profile.confirm_your_current_password_to_get_started"),
    },
    scanQRCode: {
      title: t("workspace.settings.profile.enable_two_factor_authentication"),
      description: t("workspace.settings.profile.scan_the_qr_code_below_with_your_authenticator_app"),
    },
    enterCode: {
      title: t("workspace.settings.profile.enable_two_factor_authentication"),
      description: t("workspace.settings.profile.enter_the_code_from_your_authenticator_app_below"),
    },
    backupCodes: {
      title: t("workspace.settings.profile.enable_two_factor_authentication"),
      description: t("workspace.settings.profile.save_the_following_backup_codes_in_a_safe_place"),
    },
  }[currentStep];

  return (
    <Dialog open={open} onOpenChange={() => resetState()}>
      <DialogContent width="narrow">
        <DialogHeader>
          <DialogTitle data-testid="backup-codes-title">{copy.title}</DialogTitle>
          <DialogDescription data-testid="backup-codes-description">{copy.description}</DialogDescription>
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
