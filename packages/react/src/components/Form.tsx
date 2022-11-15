import React, { createContext, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";

export const SchemaContext = createContext({
  schema: { pages: [] },
  setSchema: (schema: any) => schema,
});

interface OnSubmitProps {
  data: any;
  schema: any;
  event?: React.BaseSyntheticEvent<object, any, any> | undefined;
}

interface FormProps {
  incompleteMessage?: string;
  onSubmit: ({ data, schema, event }: OnSubmitProps) => void;
  children: React.ReactNode;
}

export function Form({ onSubmit, children }: FormProps) {
  const [schema, setSchema] = useState<any>([]);
  const methods = useForm();
  const onFormSubmit = (data: any, event: React.BaseSyntheticEvent<object, any, any> | undefined) =>
    onSubmit({ data, schema, event });
  return (
    <SchemaContext.Provider value={{ schema, setSchema }}>
      <FormProvider {...methods}>
        <form onSubmit={methods.handleSubmit(onFormSubmit)} className="formbricks-form">
          {children}
        </form>
      </FormProvider>
    </SchemaContext.Provider>
  );
}
