import { useContext, useEffect } from "react";
import { SchemaContext } from "../components/Form";

export const getOptionsSchema = (options: any[] | undefined) => {
  const newOptions = [];
  if (options) {
    for (const option of options) {
      if (typeof option === "string") {
        newOptions.push({ label: option, value: option });
      }
      if (typeof option === "object" && "value" in option && "label" in option) {
        newOptions.push({ label: option.label, value: option.value });
      }
    }
  }
  return newOptions;
};

export const useSchema = () => {
  const { schema } = useContext(SchemaContext);
  return schema;
};

export const useEffectUpdateSchema = (props: any, type: string) => {
  const { setSchema } = useContext(SchemaContext);

  useEffect(() => {
    setSchema((schema: any) => {
      const newSchema = JSON.parse(JSON.stringify(schema));
      let elementIdx = newSchema.pages[0].elements.findIndex((e: any) => e.name === props.name);
      if (elementIdx === -1) {
        newSchema.pages[0].elements.push({ ...props, type });
        elementIdx = newSchema.pages[0].elements.length - 1; // set elementIdx to newly added elem
      }
      if ("options" in props) {
        newSchema.pages[0].elements[elementIdx].options = getOptionsSchema(props.options);
      }
      return newSchema;
    });
  }, [props, setSchema]);
};
