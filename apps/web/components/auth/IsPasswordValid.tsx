import { CheckIcon } from "@heroicons/react/24/solid";
import React, { useState, useEffect } from "react";

interface Validation {
  label: string;
  state: boolean;
}

const PASSWORD_REGEX = {
  UPPER_AND_LOWER: /^(?=.*[A-Z])(?=.*[a-z])/,
  NUMBER: /\d/,
};

const DEFAULT_VALIDATIONS = [
  { label: "Mix of uppercase and lowercase", state: false },
  { label: "Minimum 8 characters long", state: false },
  { label: "Contain at least 1 number", state: false },
];

export default function IsPasswordValid({
  password,
  setIsValid,
}: {
  password: string | null;
  setIsValid: (isValid: boolean) => void;
}) {
  const [validations, setValidations] = useState<Validation[]>(DEFAULT_VALIDATIONS);

  useEffect(() => {
    let newValidations = [...DEFAULT_VALIDATIONS];
    if (password) {
      newValidations = checkValidation(newValidations, 0, PASSWORD_REGEX.UPPER_AND_LOWER.test(password));
      newValidations = checkValidation(newValidations, 1, password.length >= 8);
      newValidations = checkValidation(newValidations, 2, PASSWORD_REGEX.NUMBER.test(password));
    }
    setIsValid(newValidations.every((validation) => validation.state === true));
    setValidations(newValidations);

    function checkValidation(prevValidations, index: number, state: boolean) {
      const updatedValidations = [...prevValidations];
      updatedValidations[index].state = state;
      return updatedValidations;
    }
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
              {validation.label}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
