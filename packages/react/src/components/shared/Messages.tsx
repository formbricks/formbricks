import { ErrorMessage } from "@hookform/error-message";
import clsx from "clsx";
import React from "react";
import { FieldError, FieldErrorsImpl, Merge } from "react-hook-form";

interface HelpProps {
  name: string;
  errors?: Partial<
    FieldErrorsImpl<{
      [x: string]: any;
    }>
  >;
  messagesClassName?: string;
  messageClassName?: string;
}

export function Messages({ errors, messagesClassName, messageClassName, name }: HelpProps) {
  return (
    <>
      {/* <ul className={clsx("formbricks-messages", messagesClassName)}>
        {console.log(messages)}
        <li
          className={clsx("formbricks-message", messageClassName)}
          id="input_1-rule_required"
          data-message-type="validation">
          FormKit Input is required.
        </li>
      </ul> */}
      <ErrorMessage
        errors={errors}
        name={name}
        render={({ messages }) =>
          messages &&
          Object.entries(messages).map(([type, message]) => (
            <ul className={clsx("formbricks-messages", messagesClassName)}>
              <li
                className={clsx("formbricks-message", messageClassName)}
                id={`${name}-${type}`}
                data-message-type={type}
                role="alert">
                {message}
              </li>
            </ul>
          ))
        }
      />
    </>
  );
}
