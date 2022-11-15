export const getOptionsSchema = (options: any[] | undefined) => {
  const newOptions = [];
  if (options) {
    for (const option of options) {
      if (typeof option === "string") {
        newOptions.push({ label: option, value: option });
      }
      if (typeof option === "object" && "value" in option && "label" in option) {
        newOptions.push({ label: option.label, value: option.value });
      }
    }
  }
  return newOptions;
};
