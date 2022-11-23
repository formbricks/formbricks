import { useMemo } from "react";
import { getElementId } from "../../lib/element";
import { useEffectUpdateSchema } from "../../lib/schema";
import { SVGComponent, UniversalInputProps } from "../../types";
import ButtonComponent from "../shared/ButtonComponent";
import { Help } from "../shared/Help";
import { Outer } from "../shared/Outer";
import { Wrapper } from "../shared/Wrapper";

interface SubmitInputUniqueProps {
  PrefixIcon?: SVGComponent;
  SuffixIcon?: SVGComponent;
}

type FormbricksProps = SubmitInputUniqueProps & UniversalInputProps;

const inputType = "submit";

export function Submit(props: FormbricksProps) {
  const elemId = useMemo(() => getElementId(props.id, props.name), [props.id, props.name]);
  useEffectUpdateSchema(props, inputType);

  return (
    <Outer inputType={inputType} outerClassName={props.outerClassName}>
      <Wrapper wrapperClassName={props.wrapperClassName}>
        <ButtonComponent type="submit" elemId={elemId} {...props} />
      </Wrapper>
      <Help help={props.help} elemId={elemId} />
    </Outer>
  );
}
