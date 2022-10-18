import React, { createContext, FC, ReactNode, useContext, useEffect, useState } from "react";
import { classNamesConcat } from "../../lib/utils";
import { CurrentPageContext, SchemaContext, SubmitHandlerContext } from "../SnoopForm/SnoopForm";

export const PageContext = createContext("");

interface Props {
  name: string;
  className?: string;
  children?: ReactNode;
  thankyou?: boolean;
}

export const SnoopPage: FC<Props> = ({ name, className, children, thankyou = false }) => {
  const { schema, setSchema } = useContext<any>(SchemaContext);
  const handleSubmit = useContext(SubmitHandlerContext);
  const [initializing, setInitializing] = useState(true);
  const { currentPageIdx } = useContext(CurrentPageContext);

  useEffect(() => {
    setSchema((schema: any) => {
      const newSchema = { ...schema };
      let pageIdx = newSchema.pages.findIndex((p: any) => p.name === name);
      if (pageIdx !== -1) {
        console.warn(`🦝 SnoopForms: Page with the name "${name}" already exists`);
        return newSchema;
      }
      newSchema.pages.push({
        name,
        type: thankyou ? "thankyou" : "form",
        elements: [],
      });

      return newSchema;
    });
  }, [name]);

  useEffect(() => {
    if (initializing) {
      let pageIdx = schema.pages.findIndex((p: any) => p.name === name);
      if (pageIdx !== -1) {
        setInitializing(false);
      }
    }
  }, [schema]);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSubmit(name);
  };

  if (initializing) {
    return <div />;
  }

  if (thankyou) {
    return (
      <PageContext.Provider value={name}>
        {currentPageIdx === schema.pages.findIndex((p: any) => p.name === name) && children}
      </PageContext.Provider>
    );
  } else {
    return (
      <PageContext.Provider value={name}>
        <form
          className={classNamesConcat(
            currentPageIdx === schema.pages.findIndex((p: any) => p.name === name) ? "block" : "hidden",
            "space-y-6",
            className
          )}
          onSubmit={onSubmit}>
          {children}
        </form>
      </PageContext.Provider>
    );
  }
};
