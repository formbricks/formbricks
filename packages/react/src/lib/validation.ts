export const getValidationRules = (validation: string | undefined) => {
  const validationRules: any = {};
  if (!validation) {
    return validationRules;
  }
  for (const validationRule of validation.split("|")) {
    if (validationRule === "accepted" && !("accepted" in validationRules)) {
      validationRules.accepted = {};
    }
    if (validationRule === "email" && !("email" in validationRules)) {
      validationRules.email = {};
    }
    if (validationRule === "required" && !("required" in validationRules)) {
      validationRules.required = {};
    }
    if (validationRule === "number" && !("number" in validationRules)) {
      validationRules.number = {};
    }
    if (validationRule.startsWith("max:") && !("max" in validationRules)) {
      validationRules.max = { value: validationRule.split(":")[1] };
    }
    if (validationRule.startsWith("min:") && !("min" in validationRules)) {
      validationRules.min = { value: validationRule.split(":")[1] };
    }
    if (validationRule === "url" && !("url" in validationRules)) {
      validationRules.url = {};
    }
  }
  return validationRules;
};

export const validate = (validationRules: any) => {
  const validation: any = {};
  if ("accepted" in validationRules) {
    validation.accepted = (v: string | boolean | number) =>
      v === true || v === 1 || v === "on" || v === "yes" || `This field must be accepted`;
  }
  if ("email" in validationRules) {
    validation.email = (v: string) =>
      ("email" in validationRules &&
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(
          v
        )) ||
      "Please provide a valid email address";
  }
  if ("max" in validationRules) {
    validation.max = (v: string) =>
      parseInt(v) <= validationRules.max.value ||
      `Input must be less or equal to ${validationRules.max.value}`;
  }
  if ("min" in validationRules) {
    validation.min = (v: string) =>
      parseInt(v) >= validationRules.min.value ||
      `Input must be more or equal to ${validationRules.min.value}`;
  }
  if ("number" in validationRules) {
    validation.number = (v: string) =>
      ("number" in validationRules && /^[+-]?([0-9]*[.])?[0-9]+$/.test(v)) || "Input must be a number";
  }
  if ("url" in validationRules) {
    validation.url = (v: string) =>
      ("url" in validationRules &&
        /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/.test(
          v
        )) ||
      "Please provide a valid url (including http:// or https://)";
  }
  return validation;
};
