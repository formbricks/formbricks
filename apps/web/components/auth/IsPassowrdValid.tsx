import { CheckIcon, XMarkIcon } from '@heroicons/react/24/solid';
import React, { useState } from 'react';
import { useEffect } from 'react';

export default function IsPasswordValid({password,submitted,setIsValid}:
    {password: string | null,submitted:boolean,setIsValid: (isValid: boolean) => void}) {

    interface Validation {
        label: string;
        state: boolean | null;
      }
      

  const [validations, setValidations] = useState<Validation[]>([
    { label: 'Mix of uppercase and lowercase', state: null },
    { label: 'Minimum 8 characters long', state: null },
    { label: 'Contain at least 1 number', state: null },
  ]);

  useEffect(() => {
    if(!password){
        if(submitted){
            resetValidations(false)
            return
        }
        resetValidations(null)
        return
    }
    checkPasswordLength()
    checkMixOfUpperAndLower()
    checkContainsAtLeastOneNumber()
    setIsValid(validations.every((validation) => validation.state === true))
  }, [password]);

  const resetValidations = (state) => {
    setValidations((prevValidations) =>
      prevValidations.map((validation) => ({
        ...validation,
        state: state,
      }))
    );
  };

  const checkMixOfUpperAndLower = () => {
    const hasUppercase = /[A-Z]/.test(password!);
    const hasLowercase = /[a-z]/.test(password!);
    const isMixOfUpperAndLower = hasUppercase && hasLowercase;

    setValidations((prevValidations) => {
      const updatedValidations = [...prevValidations];
      updatedValidations[0].state = isMixOfUpperAndLower;
      return updatedValidations;
    });
  };

  const checkPasswordLength =()=>{
        setValidations((prevValidations) => {
          const updatedValidations = [...prevValidations];
          updatedValidations[1].state = password!.length >= 8;
          return updatedValidations;
        });
  }


  const checkContainsAtLeastOneNumber = () => {
    const hasNumber = /\d/.test(password!);
    setValidations((prevValidations) => {
      const updatedValidations = [...prevValidations];
      updatedValidations[2].state = hasNumber;
      return updatedValidations;
    });
  };

  const renderIcon = (state) => {
    if (state === null) {
        return <span className="w-5 h-5 flex items-center justify-center"><i className="w-2 h-2 rounded-full bg-slate-700 inline-block"></i></span>;
    } else if (state) {
      return <CheckIcon className="h-5 w-5" />;
    } else {
      return <XMarkIcon className="h-5 w-5" />;
    }
  };


  return (
    <div className="sm:text-sm my-2 text-slate-700 text-left">
      <ul>
        {validations.map((validation, index) => (
          <li key={index}>
            <div className="flex items-center">
              {renderIcon(submitted ? validation.state: (validation.state? validation.state : null))}
              {validation.label}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
