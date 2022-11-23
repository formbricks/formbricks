import { useEffectUpdateSchema } from "../../lib/schema";
import { NameRequired, UniversalInputProps } from "../../types";
import { Input, InputProps } from "../shared/Input";

interface PasswordUniqueProps {
  minLength?: number;
  maxLength?: number;
  placeholder?: string;
}

type Props = PasswordUniqueProps & InputProps & UniversalInputProps & NameRequired;

const inputType = "password";

export function Password(props: Props) {
  useEffectUpdateSchema(props, inputType);

  return (
    <Input
      type={{ html: inputType, formbricks: inputType }}
      additionalValidation={{
        minLength: {
          value: props.minLength || 0,
          message: `Your answer must be at least ${props.minLength} characters long`,
        },
        maxLength: {
          value: props.maxLength || 524288,
          message: `Your answer musn't be longer than ${props.maxLength} characters`,
        },
      }}
      additionalProps={{ placeholder: props.placeholder }}
      {...props}
    />
  );
}
