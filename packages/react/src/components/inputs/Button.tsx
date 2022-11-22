import clsx from "clsx";
import React, { useMemo } from "react";
import { getElementId } from "../../lib/element";
import { useEffectUpdateSchema } from "../../lib/schema";
import { SVGComponent, UniversalInputProps } from "../../types";
import ButtonComponent from "../shared/ButtonComponent";
import { Help } from "../shared/Help";

interface ButtonInputUniqueProps {
  PrefixIcon?: SVGComponent;
  SuffixIcon?: SVGComponent;
  onClick?: React.MouseEventHandler<HTMLButtonElement> | undefined;
}

type FormbricksProps = ButtonInputUniqueProps & UniversalInputProps;

const inputType = "button";

export function Button(props: FormbricksProps) {
  const elemId = useMemo(() => getElementId(props.id, props.name), [props.id, props.name]);
  useEffectUpdateSchema(props, inputType);

  return (
    <div className={clsx("formbricks-outer", props.outerClassName)} data-type={inputType}>
      <div className={clsx("formbricks-wrapper", props.wrapperClassName)}>
        <ButtonComponent elemId={elemId} {...props} />
      </div>
      {props.help && <Help help={props.help} elemId={elemId} />}
    </div>
  );
}
