import { useEffectUpdateSchema } from "../../lib/schema";
import { NameRequired, UniversalInputProps } from "../../types";
import { Input, InputProps } from "../shared/Input";

interface UrlUniqueProps {
  minLength?: number;
  maxLength?: number;
}

type Props = UrlUniqueProps & InputProps & UniversalInputProps & NameRequired;

const inputType = "url";

export function Url(props: Props) {
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
      {...props}
    />
  );
}
