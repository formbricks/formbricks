import clsx from "clsx";
import React, { useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { getElementId } from "../../lib/element";
import { normalizeOptions } from "../../lib/options";
import { useEffectUpdateSchema } from "../../lib/schema";
import { getValidationRules } from "../../lib/validation";
import { NameRequired, OptionsArray, OptionsObjectArray, UniversalInputProps } from "../../types";
import { Help } from "../shared/Help";
import { Inner } from "../shared/Inner";
import { Label } from "../shared/Label";
import { Messages } from "../shared/Messages";
import { Outer } from "../shared/Outer";
import { Wrapper } from "../shared/Wrapper";

interface RadioInputUniqueProps {
  options?: OptionsArray | OptionsObjectArray;
}

type FormbricksProps = RadioInputUniqueProps & UniversalInputProps & NameRequired;

const inputType = "radio";

export function Radio(props: FormbricksProps) {
  const elemId = useMemo(() => getElementId(props.id, props.name), [props.id, props.name]);
  const options = useMemo(() => normalizeOptions(props.options), [props.options]);
  useEffectUpdateSchema(props, inputType);

  const {
    register,
    formState: { errors },
  } = useFormContext();
  const validationRules = getValidationRules(props.validation);

  if (!options || options.length === 0) {
    return (
      <Outer inputType={inputType} outerClassName={props.outerClassName}>
        <Wrapper wrapperClassName={props.wrapperClassName}>
          <Inner innerClassName={props.innerClassName}>
            <input
              className={clsx("formbricks-input", props.inputClassName)}
              type="radio"
              id={elemId}
              {...register(props.name, {
                required: { value: "required" in validationRules, message: "This field is required" },
              })}
            />
            <Label label={props.label} elemId={elemId} />
          </Inner>
        </Wrapper>
        <Help help={props.help} elemId={elemId} />
        <Messages {...props} />
      </Outer>
    );
  }

  return (
    <Outer inputType={inputType} outerClassName={props.outerClassName}>
      <fieldset className="formbricks-fieldset" name={props.name}>
        <legend className="formbricks-legend">{props.label}</legend>
        <Help help={props.help} elemId={elemId} />
        <div className="formbricks-options">
          {options.map((option) => (
            <div className="formbricks-option">
              <Wrapper wrapperClassName={props.wrapperClassName}>
                <Inner innerClassName={props.innerClassName}>
                  <input
                    className={clsx("formbricks-input", props.inputClassName)}
                    type="radio"
                    id={`${props.name}-${option.value}`}
                    value={option.value}
                    disabled={option?.config?.disabled}
                    {...register(props.name)}
                  />
                  <Label label={option.label} elemId={`${props.name}-${option.value}`} />
                </Inner>
              </Wrapper>
            </div>
          ))}
        </div>
      </fieldset>
      <Messages {...props} />
    </Outer>
  );
}
