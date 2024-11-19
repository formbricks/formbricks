import { enableTwoFactorAuthAction } from "@/app/(app)/environments/[environmentId]/settings/(account)/profile/actions";
import { useTranslations } from "next-intl";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import { Button } from "@formbricks/ui/components/Button";
import { OTPInput } from "@formbricks/ui/components/OTPInput";
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
  const t = useTranslations();
  const { control, handleSubmit } = useForm<TEnterCodeFormState>({
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
        toast.error(t("environments.settings.profile.the_2fa_otp_is_incorrect_please_try_again"));
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
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

            <Button size="sm">{t("common.confirm")}</Button>
          </div>
        </form>
      </div>
    </>
  );
};
