"use client";

import React from "react";
import { Controller, useFormContext } from "react-hook-form";
import { OTPInput } from "@formbricks/ui/components/OTPInput";

export const TwoFactor = () => {
  const { control, formState: { errors } } = useFormContext();

  return (
    <>
      <div className="mb-2 transition-all duration-500 ease-in-out">
        <label htmlFor="totp" className="sr-only">
          Two-factor authentication code
        </label>

        <Controller
          control={control}
          name="totpCode"
          render={({ field }) => (
            <>
              <OTPInput value={field.value ?? ""} onChange={field.onChange} valueLength={6} />
              {errors.totpCode && (
                <p className="mt-2 text-sm text-red-600" id="totpCode-error">
                  {errors.totpCode.message}
                </p>
              )}
            </>
          )}
        />
      </div>
    </>
  );
};
