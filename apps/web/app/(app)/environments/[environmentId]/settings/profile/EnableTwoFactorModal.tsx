"use client";

import {
  enableTwoFactorAuthAction,
  setupTwoFactorAuthAction,
} from "@/app/(app)/environments/[environmentId]/settings/profile/actions";
import Modal from "@/components/shared/Modal";
import { PasswordInput, Button } from "@formbricks/ui";
import Image from "next/image";
import React, { useState } from "react";
import { SubmitHandler, useForm, Controller } from "react-hook-form";
import toast from "react-hot-toast";

type TConfirmPasswordFormState = {
  password: string;
};

type TEnterCodeFormState = {
  code: string;
};

type TStep = "confirmPassword" | "scanQRCode" | "enterCode" | "backupCodes";

type TEnableTwoFactorModalProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

type TConfirmPasswordFormProps = {
  setCurrentStep: (step: TStep) => void;
  setBackupCodes: (codes: string[]) => void;
  setDataUri: (dataUri: string) => void;
  setSecret: (secret: string) => void;
};
const ConfirmPasswordForm = ({
  setBackupCodes,
  setCurrentStep,
  setDataUri,
  setSecret,
}: TConfirmPasswordFormProps) => {
  const { control, handleSubmit, setError } = useForm<TConfirmPasswordFormState>();

  const onSubmit: SubmitHandler<TConfirmPasswordFormState> = async (data) => {
    try {
      const { backupCodes, dataUri, secret } = await setupTwoFactorAuthAction(data.password);

      setBackupCodes(backupCodes);
      setDataUri(dataUri);
      setSecret(secret);

      setCurrentStep("scanQRCode");
    } catch (err) {
      setError("password", { message: err.message });
    }
  };

  return (
    <div>
      <div className="p-6">
        <h1 className="text-lg font-semibold">Enable two factor authentication</h1>
        <h3 className="text-sm text-slate-700">Confirm your current password to get started.</h3>
      </div>
      <form className="flex flex-col space-y-10" onSubmit={handleSubmit(onSubmit)}>
        <div className="px-6">
          <label htmlFor="password" className="text-sm font-medium text-slate-700">
            Password
          </label>
          <Controller
            name="password"
            control={control}
            render={({ field, formState: { errors } }) => (
              <>
                <PasswordInput
                  id="password"
                  autoComplete="current-password"
                  placeholder="*******"
                  aria-placeholder="password"
                  required
                  className="focus:border-brand focus:ring-brand block w-full rounded-md border-slate-300 shadow-sm sm:text-sm"
                  {...field}
                />

                {errors.password && (
                  <p className="mt-2 text-sm text-red-600" id="password-error">
                    {errors.password.message}
                  </p>
                )}
              </>
            )}
          />
        </div>

        <div className="flex w-full items-center justify-end space-x-4 border-t border-slate-300 p-6">
          <Button variant="secondary" type="button">
            Cancel
          </Button>

          <Button variant="darkCTA">Confirm</Button>
        </div>
      </form>
    </div>
  );
};

type TScanQRCodeProps = {
  setCurrentStep: (step: TStep) => void;
  dataUri: string;
  secret: string;
};
const ScanQRCode = ({ dataUri, secret, setCurrentStep }: TScanQRCodeProps) => {
  return (
    <div>
      <div className="p-6">
        <h1 className="text-lg font-semibold">Enable two factor authentication</h1>
        <h3 className="text-sm text-slate-700">Scan the QR code below with your authenticator app.</h3>
      </div>

      <div className="flex flex-col items-center justify-center space-y-6">
        <Image src={dataUri} alt="QR code" width={200} height={200} />
        <p className="text-sm text-slate-700">Or enter the following code manually:</p>
        <p className="text-sm font-medium text-slate-700">{secret}</p>
      </div>

      <div className="flex w-full items-center justify-end space-x-4 border-t border-slate-300 p-6">
        <Button variant="secondary" type="button">
          Cancel
        </Button>

        <Button variant="darkCTA" onClick={() => setCurrentStep("enterCode")}>
          Next
        </Button>
      </div>
    </div>
  );
};

type TEnableCodeProps = {
  setCurrentStep: (step: TStep) => void;
};
const EnterCode = ({ setCurrentStep }: TEnableCodeProps) => {
  const { control, handleSubmit } = useForm<TEnterCodeFormState>();

  const onSubmit: SubmitHandler<TEnterCodeFormState> = async (data) => {
    try {
      const { message } = await enableTwoFactorAuthAction(data.code);
      toast.success(message);
      setCurrentStep("backupCodes");
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <div>
        <div className="p-6">
          <h1 className="text-lg font-semibold">Enable two factor authentication</h1>
          <h3 className="text-sm text-slate-700">Enter the code from your authenticator app below.</h3>
        </div>

        <form className="flex flex-col space-y-10" onSubmit={handleSubmit(onSubmit)}>
          <div className="px-6">
            <label htmlFor="code" className="text-sm font-medium text-slate-700">
              Code
            </label>
            <Controller
              name="code"
              control={control}
              render={({ field, formState: { errors } }) => (
                <>
                  <input
                    id="code"
                    autoComplete="off"
                    placeholder="123456"
                    aria-placeholder="code"
                    required
                    className="focus:border-brand focus:ring-brand block w-full rounded-md border-slate-300 shadow-sm sm:text-sm"
                    {...field}
                  />

                  {errors.code && (
                    <p className="mt-2 text-sm text-red-600" id="code-error">
                      {errors.code.message}
                    </p>
                  )}
                </>
              )}
            />
          </div>

          <div className="flex w-full items-center justify-end space-x-4 border-t border-slate-300 p-6">
            <Button variant="secondary" type="button">
              Cancel
            </Button>

            <Button variant="darkCTA">Confirm</Button>
          </div>
        </form>
      </div>
    </>
  );
};

type TDisplayBackupCodesProps = {
  backupCodes: string[];
};

const DisplayBackupCodes = ({ backupCodes }: TDisplayBackupCodesProps) => {
  const formatBackupCode = (code: string) => `${code.slice(0, 5)}-${code.slice(5, 10)}`;

  const handleDownloadBackupCode = () => {
    const formattedCodes = backupCodes.map((code) => formatBackupCode(code)).join("\n");
    const blob = new Blob([formattedCodes], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "formbricks-backup-codes.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="p-6">
        <h1 className="text-lg font-semibold">Enable two factor authentication</h1>
        <h3 className="text-sm text-slate-700">Save the following backup codes in a safe place.</h3>
      </div>

      <div className="mx-auto mb-6 grid max-w-[60%] grid-cols-2 gap-1 text-center">
        {backupCodes.map((code) => (
          <p key={code} className="text-sm font-medium text-slate-700">
            {formatBackupCode(code)}
          </p>
        ))}
      </div>

      <div className="flex w-full items-center justify-end space-x-4 border-t border-slate-300 p-6">
        <Button variant="secondary" type="button">
          Close
        </Button>

        <Button
          variant="darkCTA"
          onClick={() => {
            navigator.clipboard.writeText(backupCodes.map((code) => formatBackupCode(code)).join("\n"));
            toast.success("Copied to clipboard");
          }}>
          Copy
        </Button>

        <Button
          variant="darkCTA"
          onClick={() => {
            handleDownloadBackupCode();
          }}>
          Download
        </Button>
      </div>
    </div>
  );
};

const EnableTwoFactorModal = ({ open, setOpen }: TEnableTwoFactorModalProps) => {
  const [currentStep, setCurrentStep] = useState<TStep>("confirmPassword");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [dataUri, setDataUri] = useState<string>("");
  const [secret, setSecret] = useState<string>("");

  return (
    <Modal open={open} setOpen={setOpen} noPadding>
      {currentStep === "confirmPassword" && (
        <ConfirmPasswordForm
          setBackupCodes={setBackupCodes}
          setCurrentStep={setCurrentStep}
          setDataUri={setDataUri}
          setSecret={setSecret}
        />
      )}

      {currentStep === "scanQRCode" && (
        <ScanQRCode setCurrentStep={setCurrentStep} dataUri={dataUri} secret={secret} />
      )}

      {currentStep === "enterCode" && <EnterCode setCurrentStep={setCurrentStep} />}

      {currentStep === "backupCodes" && <DisplayBackupCodes backupCodes={backupCodes} />}
    </Modal>
  );
};

export default EnableTwoFactorModal;
