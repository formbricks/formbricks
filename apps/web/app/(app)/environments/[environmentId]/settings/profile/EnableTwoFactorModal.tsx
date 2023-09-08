"use client";

import { setupTwoFactorAuthAction } from "@/app/(app)/environments/[environmentId]/settings/profile/actions";
import Modal from "@/components/shared/Modal";
import { PasswordInput, Button } from "@formbricks/ui";
import React, { useState } from "react";
import { SubmitHandler, useForm, Controller } from "react-hook-form";

type TConfirmPasswordFormState = {
  password: string;
};

type TStep = "confirmPassword" | "scanQRCode" | "enterCode";

type TEnableTwoFactorModalProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const ConfirmPasswordForm = ({ onSubmit }: { onSubmit: SubmitHandler<TConfirmPasswordFormState> }) => {
  const { control, handleSubmit } = useForm<TConfirmPasswordFormState>();

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

const EnableTwoFactorModal = ({ open, setOpen }: TEnableTwoFactorModalProps) => {
  const { control, handleSubmit, setError } = useForm<TConfirmPasswordFormState>();

  const [currentStep, setCurrentStep] = useState<TStep>("confirmPassword");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [dataUri, setDataUri] = useState<string>("");
  const [keyUri, setKeyUri] = useState<string>("");
  const [secret, setSecret] = useState<string>("");

  const onSubmit: SubmitHandler<TConfirmPasswordFormState> = async (data) => {
    try {
      const { backupCodes, dataUri, keyUri, secret } = await setupTwoFactorAuthAction(data.password);

      setBackupCodes(backupCodes);
      setDataUri(dataUri);
      setKeyUri(keyUri);
      setSecret(secret);

      setCurrentStep("scanQRCode");
    } catch (err) {
      setError("password", { message: err.message });
    }
  };

  return (
    <Modal open={open} setOpen={setOpen} noPadding>
      {currentStep === "confirmPassword" && <ConfirmPasswordForm onSubmit={onSubmit} />}

      {currentStep === "scanQRCode" && (
        <div>
          <div className="p-6">
            <h1 className="text-lg font-semibold">Enable two factor authentication</h1>
            <h3 className="text-sm text-slate-700">Scan the QR code below with your authenticator app.</h3>
          </div>

          <div className="flex flex-col items-center justify-center space-y-6">
            <img src={dataUri} alt="QR code" />
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
      )}

      {currentStep === "enterCode" && (
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
      )}
    </Modal>
  );
};

export default EnableTwoFactorModal;
