export const getValidationRules = (validation: string | undefined) => {
  const validationRules: any = {};
  if (!validation) {
    return validationRules;
  }
  for (const validationRule of validation.split("|")) {
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
  }
  return validationRules;
};

export const validate = (validationRules: any) => {
  const validation: any = {};
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
  return validation;
};
