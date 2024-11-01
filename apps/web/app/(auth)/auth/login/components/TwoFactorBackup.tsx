"use client";

import { useTranslations } from "next-intl";
import React from "react";
import { useFormContext } from "react-hook-form";
import { Input } from "@formbricks/ui/components/Input";

export const TwoFactorBackup = () => {
  const { register } = useFormContext();
  const t = useTranslations();

  return (
    <>
      <div className="mb-2 transition-all duration-500 ease-in-out">
        <label htmlFor="totpBackup" className="sr-only">
          {t("auth.login.backup_code")}
        </label>
        <Input
          id="totpBackup"
          required
          placeholder="XXXXX-XXXXX"
          className="focus:border-brand-dark focus:ring-brand-dark block w-full rounded-md border-slate-300 shadow-sm sm:text-sm"
          {...register("backupCode")}
        />
      </div>
    </>
  );
};
