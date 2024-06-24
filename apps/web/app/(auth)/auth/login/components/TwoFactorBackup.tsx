"use client";

import React from "react";
import { useFormContext } from "react-hook-form";
import { Input } from "@formbricks/ui/Input";

export const TwoFactorBackup = () => {
  const { register } = useFormContext();

  return (
    <>
      <div className="mb-2 transition-all duration-500 ease-in-out">
        <label htmlFor="totpBackup" className="sr-only">
          Backup code
        </label>
        <Input
          id="totpBackup"
          required
          placeholder="XXXXX-XXXXX"
          className="focus:border-brand focus:ring-brand block w-full rounded-md border-slate-300 shadow-sm sm:text-sm"
          {...register("backupCode")}
        />
      </div>
    </>
  );
};
