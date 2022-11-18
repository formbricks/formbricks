import React from "react";
import { Form } from "./Form";
import { Text, Textarea } from "./Inputs";

interface OnSubmitProps {
  data: any;
  schema: any;
  event?: React.BaseSyntheticEvent<object, any, any> | undefined;
}

interface FormbricksSchemaProps {
  schema: any;
  onSubmit: ({ data, schema, event }: OnSubmitProps) => void;
}

export function FormbricksSchema({ schema, onSubmit }: FormbricksSchemaProps) {
  // TODO validate schema
  return (
    <Form onSubmit={onSubmit}>
      {schema.map((element: any) =>
        element.type === "text" ? (
          <Text {...element} />
        ) : element.type === "textarea" ? (
          <Textarea {...element} />
        ) : null
      )}
    </Form>
  );
}
