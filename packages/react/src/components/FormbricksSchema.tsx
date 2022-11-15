import React from "react";
import { Form } from "./Form";
import { Formbricks } from "./Formbricks";

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
      {schema.map((element: any) => (
        <Formbricks {...element} />
      ))}
    </Form>
  );
}
