export const getFormattedErrorMessage = (result: {
  serverError?: string;
  validationErrors?: unknown;
}): string => {
  let message = "";

  if (result.serverError) {
    message = result.serverError;
  } else {
    const errors = result.validationErrors as
      | Record<string, { _errors?: string[] } | string[] | undefined>
      | undefined;
    message = Object.keys(errors || {})
      .map((key) => {
        const value = errors?.[key];
        if (key === "_errors" && Array.isArray(value)) return value.join(", ");
        const fieldErrors =
          value && typeof value === "object" && "_errors" in value ? value._errors : undefined;
        const fieldError = fieldErrors?.join(", ");
        if (key && fieldError?.toLowerCase().startsWith(key.toLowerCase())) {
          return fieldError;
        }
        const keyPrefix = key ? `${key}: ` : "";
        return `${keyPrefix}${fieldError}`;
      })
      .join("\n");
  }

  return message;
};
