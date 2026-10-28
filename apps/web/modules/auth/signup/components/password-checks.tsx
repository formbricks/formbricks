"use client";

import { CheckIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getPasswordRules } from "@/modules/auth/signup/lib/password-rules";

interface PasswordChecksProps {
  password: string | null;
}

const ValidationIcon = ({ state }: Readonly<{ state: boolean }>) =>
  state ? (
    <CheckIcon className="size-4 shrink-0 text-slate-800" aria-hidden="true" />
  ) : (
    <span className="flex size-4 shrink-0 items-center justify-center" aria-hidden="true">
      <i className="inline-block size-1.5 rounded-full bg-slate-400" />
    </span>
  );

/** What a new password has to contain, ticked off as the user types. Mirrors `ZUserPassword`. */
export const PasswordChecks = ({ password }: Readonly<PasswordChecksProps>) => {
  const { t } = useTranslation();
  const rules = getPasswordRules(password ?? "");

  const checks = [
    { label: t("shell.auth.password_rule_length"), state: rules.length },
    { label: t("shell.auth.password_rule_uppercase"), state: rules.uppercase },
    { label: t("shell.auth.password_rule_number"), state: rules.number },
  ];

  return (
    // aria-live announces a rule flipping as the user types (SC 4.1.3).
    <ul
      className="flex flex-col gap-1 text-[13px] leading-[18px] text-slate-600"
      aria-label={t("auth.signup.password_requirements")}
      aria-live="polite">
      {checks.map((check) => (
        <li key={check.label} className="flex items-center gap-2">
          <ValidationIcon state={check.state} />
          <span>{check.label}</span>
        </li>
      ))}
    </ul>
  );
};
