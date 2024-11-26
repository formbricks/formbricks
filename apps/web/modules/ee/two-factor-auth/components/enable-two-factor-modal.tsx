"use client";

import { ConfirmPasswordForm } from "@/modules/ee/two-factor-auth/components/confirm-password-form";
import { DisplayBackupCodes } from "@/modules/ee/two-factor-auth/components/display-backup-codes";
import { EnterCode } from "@/modules/ee/two-factor-auth/components/enter-code";
import { ScanQRCode } from "@/modules/ee/two-factor-auth/components/scan-qr-code";
import { Modal } from "@/modules/ui/components/modal";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

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

  const resetState = () => {
    setCurrentStep("confirmPassword");
    setBackupCodes([]);
    setDataUri("");
    setSecret("");
    setOpen(false);
  };

  return (
    <Modal open={open} setOpen={() => resetState()} noPadding>
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

      {currentStep === "backupCodes" && <DisplayBackupCodes backupCodes={backupCodes} setOpen={resetState} />}
    </Modal>
  );
};
