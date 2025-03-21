"use client";

import { FormControl, FormField, FormItem } from "@/modules/ui/components/form";
import { OTPInput } from "@/modules/ui/components/otp-input";
import { useTranslate } from "@tolgee/react";
import { UseFormReturn } from "react-hook-form";

interface TwoFactorProps {
  form: UseFormReturn<
    {
      email: string;
      password: string;
      totpCode?: string | undefined;
      backupCode?: string | undefined;
    },
    any,
    undefined
  >;
}

export const TwoFactor = ({ form }: TwoFactorProps) => {
  const { t } = useTranslate();

  return (
    <>
      <div className="mb-2 transition-all duration-500 ease-in-out">
        <label htmlFor="totp" className="sr-only">
          {t("auth.login.enter_your_two_factor_authentication_code")}
        </label>

        <FormField
          control={form.control}
          name="totpCode"
          render={({ field }) => (
            <FormItem className="w-full">
              <FormControl>
                <OTPInput value={field.value ?? ""} onChange={field.onChange} valueLength={6} />
              </FormControl>
            </FormItem>
          )}
        />
      </div>
    </>
  );
};
