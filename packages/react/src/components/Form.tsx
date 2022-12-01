import React, { createContext, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";

export const SchemaContext = createContext({
  schema: { pages: [] },
  setSchema: (schema: any) => schema,
});

interface OnSubmitProps {
  submission: any;
  schema: any;
  event?: React.BaseSyntheticEvent<object, any, any> | undefined;
}

interface FormProps {
  incompleteMessage?: string;
  onSubmit: ({ submission, schema, event }: OnSubmitProps) => void;
  formId?: string;
  hqUrl?: string;
  customerId?: string;
  children: React.ReactNode;
}

export function Form({ onSubmit, children, formId, customerId, hqUrl }: FormProps) {
  const [schema, setSchema] = useState<any>({
    type: "form",
    config: { formId, hqUrl },
    children: [],
  });
  const methods = useForm({ criteriaMode: "all", mode: "onChange" });
  const onFormSubmit = (data: any, event: React.BaseSyntheticEvent<object, any, any> | undefined) =>
    onSubmit({ submission: { customerId, data }, schema, event });
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
