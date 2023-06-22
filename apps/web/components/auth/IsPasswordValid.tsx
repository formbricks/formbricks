import { CheckIcon } from '@heroicons/react/24/solid';
import React, { useState, useEffect } from 'react';

interface Validation {
  label: string;
  state: boolean;
}

const PASSWORD_REGEX = {
  UPPER_AND_LOWER: /^(?=.*[A-Z])(?=.*[a-z])/,
  NUMBER: /\d/
};

export default function IsPasswordValid({ password, setIsValid }:
  { password: string | null, setIsValid: (isValid: boolean) => void }) {

  const [validations, setValidations] = useState<Validation[]>([
    { label: 'Mix of uppercase and lowercase', state: false },
    { label: 'Minimum 8 characters long', state: false },
    { label: 'Contain at least 1 number', state: false },
  ]);

  useEffect(() => {
    resetValidations(false);
    if (password) {
      checkValidation(0, PASSWORD_REGEX.UPPER_AND_LOWER.test(password));
      checkValidation(1, password.length >= 8);
      checkValidation(2, PASSWORD_REGEX.NUMBER.test(password));
    }
    setIsValid(validations.every((validation) => validation.state === true));
  }, [password, validations]);

  const resetValidations = (state: boolean) => {
    setValidations((prevValidations) =>
      prevValidations.map((validation) => ({ ...validation, state }))
    );
  };

  const checkValidation = (index: number, state: boolean) => {
    setValidations((prevValidations) => {
      const updatedValidations = [...prevValidations];
      updatedValidations[index].state = state;
      return updatedValidations;
    });
  };

  const renderIcon = (state: boolean) => {
    if (state === false) {
      return <span className="w-5 h-5 flex items-center justify-center"><i className="w-2 h-2 rounded-full bg-slate-700 inline-block"></i></span>;
    } else {
      return <CheckIcon className="h-5 w-5" />;
    }
  };

  return (
    <div className="sm:text-sm my-2 text-slate-700 text-left">
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
