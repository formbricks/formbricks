import React, { useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { getElementId } from "../../lib/element";
import { useEffectUpdateSchema } from "../../lib/schema";
import { getValidationRules, validate } from "../../lib/validation";
import { NameRequired, UniversalInputProps } from "../../types";
import { Help } from "../shared/Help";
import { Label } from "../shared/Label";
import { Messages } from "../shared/Messages";

interface TextareaInputUniqueProps {
  cols?: number;
  maxLength?: number;
  minLength?: number;
  placeholder?: string;
  rows?: number;
}

type TextareaProps = TextareaInputUniqueProps & UniversalInputProps & NameRequired;

const inputType = "textarea";

export function Textarea(props: TextareaProps) {
  const elemId = useMemo(() => getElementId(props.id, props.name), [props.id, props.name]);
  useEffectUpdateSchema(props, inputType);

  const {
    register,
    formState: { errors },
  } = useFormContext();
  const validationRules = getValidationRules(props.validation);

  return (
    <div className="formbricks-outer" data-type={inputType}>
      <div className="formbricks-wrapper">
        <Label label={props.label} elemId={elemId} />
        <div className="formbricks-inner">
          <textarea
            className="formbricks-input"
            id={elemId}
            placeholder={props.placeholder || ""}
            cols={props.cols}
            rows={props.rows}
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
      {props.help && <Help help={props.help} elemId={elemId} />}
      <Messages errors={errors} {...props} />
    </div>
  );
}
