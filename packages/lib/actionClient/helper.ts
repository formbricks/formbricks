export const getFormattedErrorMessage = (result) => {
  let message = "";

  if (result.serverError) {
    message = result.serverError;
  } else {
    const errors = result.validationErrors;
    message = Object.keys(errors || {})
      .map((key) => {
        if (key === "_errors") return errors[key].join(", ");
        return `${key ? `${key}` : ""}${errors?.[key]?._errors.join(", ")}`;
      })
      .join("\n");
  }

  return message;
};
