import { useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { getElementId } from "../../lib/element";
import { getValidationRules, validate } from "../../lib/validation";
import { NameRequired, UniversalInputProps } from "../../types";
import { Help } from "./Help";
import { Inner } from "./Inner";
import { Label } from "./Label";
import { Messages } from "./Messages";
import { Outer } from "./Outer";
import { Wrapper } from "./Wrapper";

export interface InputProps {
  placeholder?: string;
}

interface UniqueProps {
  additionalValidation?: any;
  additionalProps?: any;
  type: {
    formbricks: string;
    html: string;
  };
}

type FormbricksProps = UniqueProps & InputProps & UniversalInputProps & NameRequired;

export function Input(props: FormbricksProps) {
  const elemId = useMemo(() => getElementId(props.id, props.name), [props.id, props.name]);

  const {
    register,
    formState: { errors },
  } = useFormContext();
  const validationRules = getValidationRules(props.validation);

  return (
    <Outer inputType={props.type.formbricks} outerClassName={props.outerClassName}>
      <Wrapper wrapperClassName={props.wrapperClassName}>
        <Label label={props.label} elemId={elemId} labelClassName={props.labelClassName} />
        <Inner innerClassName={props.innerClassName}>
          <input
            className={props.inputClassName || "formbricks-input"}
            type={props.type.html}
            id={elemId}
            aria-invalid={errors[props.name] ? "true" : "false"}
            placeholder={props.placeholder}
            {...props.additionalProps}
            {...register(props.name, {
              required: { value: "required" in validationRules, message: "This field is required" },
              validate: validate(validationRules),
              ...props.additionalValidation,
            })}
          />
        </Inner>
      </Wrapper>
      <Help help={props.help} elemId={elemId} helpClassName={props.helpClassName} />
      <Messages {...props} />
    </Outer>
  );
}
