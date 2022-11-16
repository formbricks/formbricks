import React, { useContext, useEffect, useMemo } from "react";
import { generateId } from "../lib/utils";
import { getValidationRules } from "../lib/validation";
import { SchemaContext } from "./Form";
import { Text, TextInputUniqueProps } from "./inputs/Text";
import { Textarea, TextareaInputUniqueProps } from "./inputs/Textarea";
import { Help } from "./shared/Help";

interface TypeProps {
  type: "text" | "textarea" | "submit";
}

interface SubmitTypeProps {
  id?: string;
  name?: string;
  label?: string;
  placeholder?: string;
  help?: string;
  validation?: string;
}

export interface UniversalInputProps {
  id?: string;
  help?: string;
  name?: string;
  label?: string;
  elemId: string;
  validation?: string;
}

type FormbricksProps = TextInputUniqueProps & TextareaInputUniqueProps & SubmitTypeProps & TypeProps;

export function Formbricks({
  id,
  name,
  label,
  placeholder,
  help,
  type,
  validation,
  minLength,
  maxLength,
}: FormbricksProps) {
  const elemId = useMemo(() => (typeof id !== "undefined" ? id : `${name}=${generateId(3)}`), [id]);
  const { setSchema } = useContext(SchemaContext);

  useEffect(() => {
    setSchema((schema: any) => {
      const newSchema = JSON.parse(JSON.stringify(schema));
      let elementIdx = newSchema.findIndex((e: any) => e.name === name);
      if (elementIdx === -1) {
        newSchema.push({
          id,
          name,
          label,
          placeholder,
          help,
          type,
          validation,
          minLength,
          maxLength,
        });
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
          <Text
            name={name}
            label={label}
            elemId={elemId}
            placeholder={placeholder}
            validation={validation}
            minLength={minLength}
            maxLength={maxLength}
          />
        ) : type === "textarea" ? (
          <Textarea
            name={name}
            label={label}
            elemId={elemId}
            placeholder={placeholder}
            validation={validation}
            minLength={minLength}
            maxLength={maxLength}
          />
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
