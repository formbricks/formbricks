"use client";

import { useTranslate } from "@tolgee/react";
import { CheckIcon } from "lucide-react";
import { useMemo } from "react";

interface PasswordChecksProps {
  password: string | null;
}

const PASSWORD_REGEX = {
  UPPER_AND_LOWER: /^(?=.*[A-Z])(?=.*[a-z])/,
  NUMBER: /\d/,
};

const ValidationIcon = ({ state }: { state: boolean }) =>
  state ? (
    <CheckIcon className="h-5 w-5" />
  ) : (
    <span className="flex h-5 w-5 items-center justify-center">
      <i className="inline-block h-2 w-2 rounded-full bg-slate-700" />
    </span>
  );

export const PasswordChecks = ({ password }: PasswordChecksProps) => {
  const { t } = useTranslate();

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
    <div className="my-2 text-left text-slate-700 sm:text-sm">
      <ul role="list" aria-label="Password requirements">
        {validations.map((validation) => (
          <li key={validation.label} className="flex items-center">
            <ValidationIcon state={validation.state} />
            {validation.label}
          </li>
        ))}
      </ul>
    </div>
  );
};
