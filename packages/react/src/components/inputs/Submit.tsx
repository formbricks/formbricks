import React, { useMemo } from "react";
import { getElementId } from "../../lib/element";
import { useEffectUpdateSchema } from "../../lib/schema";
import { UniversalInputProps } from "../../types";
import { Help } from "../shared/Help";

interface SubmitInputUniqueProps {}

type FormbricksProps = SubmitInputUniqueProps & UniversalInputProps;

const inputType = "submit";

export function Submit(props: FormbricksProps) {
  const elemId = useMemo(() => getElementId(props.id, props.name), [props.id, props.name]);
  useEffectUpdateSchema(props, inputType);

  return (
    <div className="formbricks-outer" data-type={inputType}>
      <div className="formbricks-wrapper">
        <button className="formbricks-input" type="submit" id={elemId}>
          {props.label}
        </button>
      </div>
      {props.help && <Help help={props.help} elemId={elemId} />}
    </div>
  );
}
