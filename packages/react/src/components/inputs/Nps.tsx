import { RadioGroup } from "@headlessui/react";
import { useMemo } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { getElementId } from "../../lib/element";
import { useEffectUpdateSchema } from "../../lib/schema";
import { NameRequired, UniversalInputProps } from "../../types";
import { Help } from "../shared/Help";
import { Inner } from "../shared/Inner";
import { Label } from "../shared/Label";
import { Messages } from "../shared/Messages";
import { Options } from "../shared/Options";
import { Outer } from "../shared/Outer";
import { Wrapper } from "../shared/Wrapper";

interface NpsInputUniqueProps {
  optionsClassName?: string;
  optionClassName?: string;
}

type NpsProps = NpsInputUniqueProps & UniversalInputProps & NameRequired;

const inputType = "nps";

export function Nps(props: NpsProps) {
  const elemId = useMemo(() => getElementId(props.id, props.name), [props.id, props.name]);
  useEffectUpdateSchema(props, inputType);

  const { control } = useFormContext();

  return (
    <Outer inputType={inputType} outerClassName={props.outerClassName}>
      <Wrapper wrapperClassName={props.wrapperClassName}>
        <Label label={props.label} elemId={elemId} labelClassName={props.labelClassName} />
        <Inner innerClassName={props.innerClassName}>
          <Controller
            name={props.name}
            control={control}
            rules={{ required: true }}
            render={({ field }: any) => (
              <RadioGroup {...field} id="test">
                <RadioGroup.Label className="sr-only">Choose a number from 0 to 10</RadioGroup.Label>
                <Options optionsClassName={props.optionsClassName}>
                  {[...Array(11).keys()].map((option) => (
                    <RadioGroup.Option
                      key={option}
                      value={option}
                      className={props.optionClassName || "formbricks-option"}>
                      <Wrapper wrapperClassName={props.wrapperClassName}>
                        <Inner innerClassName={props.innerClassName}>
                          <RadioGroup.Label as="span" className={props.inputClassName || "formbricks-input"}>
                            {option}
                          </RadioGroup.Label>
                        </Inner>
                      </Wrapper>
                    </RadioGroup.Option>
                  ))}
                </Options>
                <div className="formbricks-input-addition">
                  <p className="formbricks-input-addition-item">not likely</p>
                  <p className="formbricks-input-addition-item">very likely</p>
                </div>
              </RadioGroup>
            )}
          />

          {/* <textarea
            className={props.inputClassName || "formbricks-input"}
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
          /> */}
        </Inner>
      </Wrapper>
      <Help help={props.help} elemId={elemId} helpClassName={props.helpClassName} />
      <Messages {...props} />
    </Outer>
  );
}
