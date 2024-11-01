"use client";

import { useTranslations } from "next-intl";
import React from "react";
import { Controller, useFormContext } from "react-hook-form";
import { OTPInput } from "@formbricks/ui/components/OTPInput";

export const TwoFactor = () => {
  const { control } = useFormContext();
  const t = useTranslations();

  return (
    <>
      <div className="mb-2 transition-all duration-500 ease-in-out">
        <label htmlFor="totp" className="sr-only">
          {t("auth.login.enter_your_two_factor_authentication_code")}
        </label>

        <Controller
          control={control}
          name="totpCode"
          render={({ field }) => (
            <OTPInput value={field.value ?? ""} onChange={field.onChange} valueLength={6} />
          )}
        />
      </div>
    </>
  );
};
