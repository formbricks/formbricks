import { CheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

interface Validation {
  label: string;
  state: boolean;
}

const PASSWORD_REGEX = {
  UPPER_AND_LOWER: /^(?=.*[A-Z])(?=.*[a-z])/,
  NUMBER: /\d/,
};

const DEFAULT_VALIDATIONS = [
  { label: "auth.signup.password_validation_uppercase_and_lowercase", state: false },
  { label: "auth.signup.password_validation_minimum_8_and_maximum_128_characters", state: false },
  { label: "auth.signup.password_validation_contain_at_least_1_number", state: false },
];

export const IsPasswordValid = ({
  password,
  setIsValid,
}: {
  password: string | null;
  setIsValid: (isValid: boolean) => void;
}) => {
  const t = useTranslations();
  const [validations, setValidations] = useState<Validation[]>(DEFAULT_VALIDATIONS);

  useEffect(() => {
    let newValidations = [...DEFAULT_VALIDATIONS];

    const checkValidation = (prevValidations: Validation[], index: number, state: boolean) => {
      const updatedValidations = [...prevValidations];
      updatedValidations[index].state = state;
      return updatedValidations;
    };

    if (password !== null) {
      newValidations = checkValidation(newValidations, 0, PASSWORD_REGEX.UPPER_AND_LOWER.test(password));
      newValidations = checkValidation(newValidations, 1, password.length >= 8 && password.length <= 128);
      newValidations = checkValidation(newValidations, 2, PASSWORD_REGEX.NUMBER.test(password));
    }
    setIsValid(newValidations.every((validation) => validation.state === true));
    setValidations(newValidations);
  }, [password, setIsValid]);

  const renderIcon = (state: boolean) => {
    if (state === false) {
      return (
        <span className="flex h-5 w-5 items-center justify-center">
          <i className="inline-block h-2 w-2 rounded-full bg-slate-700"></i>
        </span>
      );
    } else {
      return <CheckIcon className="h-5 w-5" />;
    }
  };

  return (
    <div className="my-2 text-left text-slate-700 sm:text-sm">
      <ul>
        {validations.map((validation, index) => (
          <li key={index}>
            <div className="flex items-center">
              {renderIcon(validation.state)}
              {t(validation.label)}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
