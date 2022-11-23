import { useEffectUpdateSchema } from "../../lib/schema";
import { NameRequired, UniversalInputProps } from "../../types";
import { Input, InputProps } from "../shared/Input";

interface InputUniqueProps {
  min?: number;
  max?: number;
  step?: number;
}

type Props = InputUniqueProps & InputProps & UniversalInputProps & NameRequired;

const inputType = "number";

export function Number(props: Props) {
  useEffectUpdateSchema(props, inputType);

  return (
    <Input
      type={{ html: inputType, formbricks: inputType }}
      additionalValidation={{
        min: {
          value: props.min,
          message: `The minimum number allowed is ${props.min}`,
        },
        max: {
          value: props.max,
          message: `The minimum number allowed is ${props.max}`,
        },
      }}
      additionalProps={{
        step: props.step,
      }}
      {...props}
    />
  );
}
