import clsx from "clsx";
import React, { useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { getElementId } from "../../lib/element";
import { useEffectUpdateSchema } from "../../lib/schema";
import { getValidationRules, validate } from "../../lib/validation";
import { NameRequired, UniversalInputProps } from "../../types";
import { Help } from "../shared/Help";
import { Label } from "../shared/Label";
import { Messages } from "../shared/Messages";

interface TextInputUniqueProps {
  maxLength?: number;
  minLength?: number;
  placeholder?: string;
}

type FormbricksProps = TextInputUniqueProps & UniversalInputProps & NameRequired;

const inputType = "text";

export function Text(props: FormbricksProps) {
  const elemId = useMemo(() => getElementId(props.id, props.name), [props.id, props.name]);
  useEffectUpdateSchema(props, inputType);

  const {
    register,
    formState: { errors },
  } = useFormContext();
  const validationRules = getValidationRules(props.validation);

  return (
    <div className={clsx("formbricks-outer", props.outerClassName)} data-type={inputType}>
      <div className={clsx("formbricks-wrapper", props.wrapperClassName)}>
        <Label label={props.label} elemId={elemId} />
        <div className={clsx("formbricks-inner", props.innerClassName)}>
          <input
            className={clsx("form-input", "formbricks-input", props.inputClassName)}
            type="text"
            id={elemId}
            placeholder={props.placeholder || ""}
            aria-invalid={errors[props.name] ? "true" : "false"}
            {...register(props.name, {
              required: { value: "required" in validationRules, message: "This field is required" },
              minLength: {
                value: props.minLength || 0,
                message: `Your answer must be at least ${props.minLength} characters long`,
              },
              maxLength: {
                value: props.maxLength || 524288,
                message: `Your answer musn't be longer than ${props.maxLength} characters`,
              },
              validate: validate(validationRules),
            })}
          />
        </div>
      </div>
      {props.help && <Help help={props.help} elemId={elemId} helpClassName={props.helpClassName} />}
      <Messages errors={errors} {...props} />
    </div>
  );
}
