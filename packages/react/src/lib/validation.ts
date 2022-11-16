export const getValidationRules = (validation: string | undefined) => {
  const validationRules: string[] = [];
  if (!validation) {
    return validationRules;
  }
  for (const validationRule of validation.split("|")) {
    if (validationRule === "required" || !validationRules.includes("required")) {
      validationRules.push("required");
    }
  }
  return validationRules;
};
