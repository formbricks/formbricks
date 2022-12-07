import { useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { getElementId } from "../../lib/element";
import { normalizeOptions } from "../../lib/options";
import { useEffectUpdateSchema } from "../../lib/schema";
import { getValidationRules } from "../../lib/validation";
import { NameRequired, OptionsArray, OptionsObjectArray, UniversalInputProps } from "../../types";
import { Fieldset } from "../shared/Fieldset";
import { Help } from "../shared/Help";
import { Inner } from "../shared/Inner";
import { Label } from "../shared/Label";
import { Legend } from "../shared/Legend";
import { Messages } from "../shared/Messages";
import { Option } from "../shared/Option";
import { Options } from "../shared/Options";
import { Outer } from "../shared/Outer";
import { Wrapper } from "../shared/Wrapper";

interface RadioInputUniqueProps {
  options?: OptionsArray | OptionsObjectArray;
  fieldsetClassName?: string;
  legendClassName?: string;
  optionsClassName?: string;
  optionClassName?: string;
}

type FormbricksProps = RadioInputUniqueProps & UniversalInputProps & NameRequired;

const inputType = "radio";

export function Radio(props: FormbricksProps) {
  const elemId = useMemo(() => getElementId(props.id, props.name), [props.id, props.name]);
  const options = useMemo(() => normalizeOptions(props.options), [props.options]);
  useEffectUpdateSchema(props, inputType);

  const { register } = useFormContext();
  const validationRules = getValidationRules(props.validation);

  if (!options || options.length === 0) {
    return (
      <Outer inputType={inputType} outerClassName={props.outerClassName}>
        <Wrapper wrapperClassName={props.wrapperClassName}>
          <Inner innerClassName={props.innerClassName}>
            <input
              className={props.inputClassName || "formbricks-input"}
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
      <Fieldset fieldsetClassName={props.fieldsetClassName} name={props.name}>
        <Legend legendClassName={props.legendClassName}>{props.label}</Legend>
        <Help help={props.help} elemId={elemId} />
        <Options optionsClassName={props.optionsClassName}>
          {options.map((option) => (
            <Option key={`${props.name}-${option.value}`} optionClassName={props.optionClassName}>
              <Wrapper wrapperClassName={props.wrapperClassName}>
                <Inner innerClassName={props.innerClassName}>
                  <input
                    className={props.inputClassName || "formbricks-input"}
                    type="radio"
                    id={`${props.name}-${option.value}`}
                    value={option.value}
                    disabled={option?.config?.disabled}
                    {...register(props.name)}
                  />
                  <Label
                    label={option.label}
                    elemId={`${props.name}-${option.value}`}
                    labelClassName={props.labelClassName}
                  />
                </Inner>
              </Wrapper>
            </Option>
          ))}
        </Options>
      </Fieldset>
      <Messages {...props} />
    </Outer>
  );
}
