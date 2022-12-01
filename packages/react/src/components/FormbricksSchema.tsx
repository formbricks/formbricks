import React from "react";
import { Text, Textarea } from "..";
import { Form } from "./Form";

interface OnSubmitProps {
  submission: any;
  schema: any;
  event?: React.BaseSyntheticEvent<object, any, any> | undefined;
}

interface FormbricksSchemaProps {
  schema: any;
  onSubmit: ({ submission, schema, event }: OnSubmitProps) => void;
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
