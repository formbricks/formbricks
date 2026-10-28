"use client";

import { useTranslation } from "react-i18next";
import { OTPInput } from "@/modules/auth/components/otp-input";

interface TwoFactorProps {
  value: string;
  onChange: (value: string) => void;
}

/** The six-digit authenticator code step of the login form. */
export const TwoFactor = ({ value, onChange }: Readonly<TwoFactorProps>) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2">
      <span className="sr-only">{t("auth.login.enter_your_two_factor_authentication_code")}</span>
      <OTPInput value={value} onChange={onChange} valueLength={6} />
    </div>
  );
};
