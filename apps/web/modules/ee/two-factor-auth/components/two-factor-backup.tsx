"use client";

import { useTranslations } from "next-intl";
import React from "react";
import { UseFormReturn } from "react-hook-form";
import { FormField, FormItem } from "@formbricks/ui/components/Form";
import { FormControl } from "@formbricks/ui/components/Form";
import { Input } from "@formbricks/ui/components/Input";

interface TwoFactorBackupProps {
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

export const TwoFactorBackup = ({ form }: TwoFactorBackupProps) => {
  const t = useTranslations();

  return (
    <>
      <div className="mb-2 transition-all duration-500 ease-in-out">
        <label htmlFor="totpBackup" className="sr-only">
          {t("auth.login.backup_code")}
        </label>
        <FormField
          control={form.control}
          name="backupCode"
          render={({ field }) => (
            <FormItem className="w-full">
              <FormControl>
                <Input
                  id="totpBackup"
                  required
                  placeholder="XXXXX-XXXXX"
                  className="focus:border-brand-dark focus:ring-brand-dark block w-full rounded-md border-slate-300 shadow-sm sm:text-sm"
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                />
              </FormControl>
            </FormItem>
          )}
        />
      </div>
    </>
  );
};
