"use client";

import { useTranslation } from "react-i18next";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";

interface TwoFactorBackupProps {
  value: string;
  onChange: (value: string) => void;
}

/** The backup-code step of the login form, for someone without their authenticator app. */
export const TwoFactorBackup = ({ value, onChange }: Readonly<TwoFactorBackupProps>) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="totpBackup" className="sr-only">
        {t("auth.login.backup_code")}
      </Label>
      <Input
        id="totpBackup"
        required
        autoComplete="off"
        placeholder="XXXXX-XXXXX"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
};
