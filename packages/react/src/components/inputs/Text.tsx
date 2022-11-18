import clsx from "clsx";
import React, { useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { getElementId } from "../../lib/element";
import { useEffectUpdateSchema } from "../../lib/schema";
import { getValidationRules } from "../../lib/validation";
import { UniversalInputProps } from "../../types";
import { Help } from "../shared/Help";
import { Label } from "../shared/Label";

interface TextInputUniqueProps {
  maxLength?: number;
  minLength?: number;
  placeholder?: string;
}

type FormbricksProps = TextInputUniqueProps & UniversalInputProps;

const inputType = "text";

export function Text(props: FormbricksProps) {
  const elemId = useMemo(() => getElementId(props.id, props.name), [props.id, props.name]);
  useEffectUpdateSchema(props, inputType);

  const { register } = useFormContext();
  const validationRules = getValidationRules(props.validation);

  return (
    <div className={clsx("formbricks-outer", props.outerClassName)} data-type={inputType}>
      <div className={clsx("formbricks-wrapper", props.wrapperClassName)}>
        <Label label={props.label} elemId={elemId} />
        <div className={clsx("formbricks-inner", props.innerClassName)}>
          <input
            className={clsx("formbricks-input", props.inputClassName)}
            type="text"
            id={elemId}
            placeholder={props.placeholder || ""}
            {...register(props.name, {
              required: validationRules?.includes("required"),
              minLength: props.minLength,
              maxLength: props.maxLength,
            })}
          />
        </div>
      </div>
      {props.help && <Help help={props.help} elemId={elemId} helpClassName={props.helpClassName} />}
    </div>
  );
}
