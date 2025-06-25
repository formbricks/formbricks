"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { enableTwoFactorAuthAction } from "@/modules/ee/two-factor-auth/actions";
import { Button } from "@/modules/ui/components/button";
import { OTPInput } from "@/modules/ui/components/otp-input";
import { useTranslate } from "@tolgee/react";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import { EnableTwoFactorModalStep } from "./enable-two-factor-modal";

interface EnterCodeProps {
  setCurrentStep: (step: EnableTwoFactorModalStep) => void;
  setOpen: (open: boolean) => void;
  refreshData: () => void;
}

const ZEnterCodeFormState = z.object({
  code: z.string().length(6),
});

type TEnterCodeFormState = z.infer<typeof ZEnterCodeFormState>;

export const EnterCode = ({ setCurrentStep, setOpen, refreshData }: EnterCodeProps) => {
  const { t } = useTranslate();
  const { control, handleSubmit, formState } = useForm<TEnterCodeFormState>({
    defaultValues: {
      code: "",
    },
  });

  const onSubmit: SubmitHandler<TEnterCodeFormState> = async (data) => {
    try {
      const enableTwoFactorAuthResponse = await enableTwoFactorAuthAction({ code: data.code });
      if (enableTwoFactorAuthResponse?.data) {
        toast.success(enableTwoFactorAuthResponse.data.message);
        setCurrentStep("backupCodes");

        // refresh data to update the UI
        refreshData();
      } else {
        const errorMessage = getFormattedErrorMessage(enableTwoFactorAuthResponse);
        toast.error(errorMessage);
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div>
      <div className="p-6">
        <h1 className="text-lg font-semibold">
          {t("environments.settings.profile.enable_two_factor_authentication")}
        </h1>
        <h3 className="text-sm text-slate-700">
          {t("environments.settings.profile.enter_the_code_from_your_authenticator_app_below")}
        </h3>
      </div>

      <form className="flex flex-col space-y-10" onSubmit={handleSubmit(onSubmit)}>
        <div className="flex flex-col gap-2 px-6">
          <label htmlFor="code" className="text-sm font-medium text-slate-700">
            {t("common.code")}
          </label>
          <Controller
            name="code"
            control={control}
            render={({ field, formState: { errors } }) => (
              <>
                <OTPInput
                  value={field.value}
                  onChange={field.onChange}
                  valueLength={6}
                  containerClassName="justify-start"
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

        <div className="flex w-full items-center justify-end space-x-4 border-t border-slate-300 p-4">
          <Button variant="secondary" size="sm" type="button" onClick={() => setOpen(false)}>
            {t("common.cancel")}
          </Button>

          <Button size="sm" loading={formState.isSubmitting}>
            {t("common.confirm")}
          </Button>
        </div>
      </form>
    </div>
  );
};
