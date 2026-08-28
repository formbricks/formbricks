"use client";

import { CheckIcon } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

interface PasswordChecksProps {
  password: string | null;
}

const PASSWORD_REGEX = {
  UPPER_AND_LOWER: /^(?=.*[A-Z])(?=.*[a-z])/,
  NUMBER: /\d/,
};

const ValidationIcon = ({ state }: { state: boolean }) =>
  state ? (
    <CheckIcon className="size-5 shrink-0" aria-hidden="true" />
  ) : (
    <span className="flex size-5 shrink-0 items-center justify-center" aria-hidden="true">
      <i className="inline-block size-2 rounded-full bg-slate-700" />
    </span>
  );

export const PasswordChecks = ({ password }: PasswordChecksProps) => {
  const { t } = useTranslation();

  const DEFAULT_VALIDATIONS = [
    { label: t("auth.signup.password_validation_uppercase_and_lowercase"), state: false },
    { label: t("auth.signup.password_validation_minimum_8_and_maximum_128_characters"), state: false },
    { label: t("auth.signup.password_validation_contain_at_least_1_number"), state: false },
  ];

  const validations = useMemo(() => {
    if (password === null) return DEFAULT_VALIDATIONS;

    return [
      {
        label: t("auth.signup.password_validation_uppercase_and_lowercase"),
        state: PASSWORD_REGEX.UPPER_AND_LOWER.test(password),
      },
      {
        label: t("auth.signup.password_validation_minimum_8_and_maximum_128_characters"),
        state: password.length >= 8 && password.length <= 128,
      },
      {
        label: t("auth.signup.password_validation_contain_at_least_1_number"),
        state: PASSWORD_REGEX.NUMBER.test(password),
      },
    ];
  }, [password]);

  return (
    // text-sm unconditionally: with only `sm:text-sm` the list rendered *larger* on a phone
    // than on desktop. aria-live announces a rule flipping as the user types (SC 4.1.3).
    <div className="my-2 text-left text-sm text-slate-700">
      <ul aria-label={t("auth.signup.password_requirements")} aria-live="polite">
        {validations.map((validation) => (
          <li key={validation.label} className="flex items-start gap-2">
            <ValidationIcon state={validation.state} />
            <span>{validation.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
