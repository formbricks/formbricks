"use client";

import React from "react";
import { Controller, useFormContext } from "react-hook-form";
import { OTPInput } from "@formbricks/ui/OTPInput";

export const TwoFactor = () => {
  const { control } = useFormContext();

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
            <OTPInput value={field.value ?? ""} onChange={field.onChange} valueLength={6} />
          )}
        />
      </div>
    </>
  );
};
