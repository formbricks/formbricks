"use client";

import { Controller, SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { getFormattedErrorMessage } from "@/lib/utils/error-message";
import { OTPInput } from "@/modules/auth/components/otp-input";
import { enableTwoFactorAuthAction } from "@/modules/ee/two-factor-auth/actions";
import { Button } from "@/modules/ui/components/button";
import { Label } from "@/modules/ui/components/label";
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

export const EnterCode = ({ setCurrentStep, setOpen, refreshData }: Readonly<EnterCodeProps>) => {
  const { t } = useTranslation();
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
      toast.error(err instanceof Error ? err.message : t("common.something_went_wrong"));
    }
  };

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit(onSubmit)}>
      <div className="flex flex-col gap-2">
        <Label>{t("common.code")}</Label>
        <Controller
          name="code"
          control={control}
          render={({ field }) => (
            <OTPInput
              value={field.value}
              onChange={field.onChange}
              valueLength={6}
              containerClassName="justify-start"
            />
          )}
        />
      </div>

      <div className="flex w-full items-center justify-end gap-2">
        <Button variant="outline" type="button" onClick={() => setOpen(false)}>
          {t("common.cancel")}
        </Button>

        <Button loading={formState.isSubmitting}>{t("common.confirm")}</Button>
      </div>
    </form>
  );
};
