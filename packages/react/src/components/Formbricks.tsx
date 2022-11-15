import React, { useContext, useEffect, useMemo } from "react";
import { generateId } from "../lib/utils";
import { SchemaContext } from "./Form";
import { Text } from "./inputs/Text";
import { Textarea } from "./inputs/Textarea";
import { Help } from "./shared/Help";

interface BasicTypeProps {
  id?: string;
  name: string;
  label?: string;
  placeholder?: string;
  type: "text" | "textarea";
  help?: string;
}

interface SubmitTypeProps {
  id?: string;
  name?: string;
  label?: string;
  placeholder?: string;
  type: "submit";
  help?: string;
}

type FormbricksProps = BasicTypeProps | SubmitTypeProps;

export function Formbricks({ id, name, label, placeholder, help, type }: FormbricksProps) {
  const elemId = useMemo(() => (typeof id !== "undefined" ? id : `${name}=${generateId(3)}`), [id]);
  const { schema, setSchema } = useContext(SchemaContext);

  useEffect(() => {
    setSchema((schema: any) => {
      const newSchema = JSON.parse(JSON.stringify(schema));
      let elementIdx = newSchema.findIndex((e: any) => e.name === name);
      if (elementIdx === -1) {
        newSchema.push({ name, type, label, help });
        elementIdx = newSchema.length - 1;
      }
      /* if (["checkbox", "radio"].includes(type)) {
        newSchema.elements[elementIdx].options = getOptionsSchema(options);
      } */
      return newSchema;
    });
  }, [name, setSchema]);

  return (
    <div className="formbricks-outer" data-type={type} data-family={type}>
      <div className="formbricks-wrapper">
        {type === "text" ? (
          <Text name={name} label={label} elemId={elemId} placeholder={placeholder} />
        ) : type === "textarea" ? (
          <Textarea name={name} label={label} elemId={elemId} placeholder={placeholder} />
        ) : type === "submit" ? (
          <button className="formbricks-input" type="submit" id={elemId}>
            {label}
          </button>
        ) : null}
      </div>
      {help && <Help help={help} elemId={elemId} />}
    </div>
  );
}
