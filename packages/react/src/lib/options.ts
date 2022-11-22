import { OptionsArray, OptionsObjectArray } from "../types";

export const normalizeOptions = (options?: OptionsArray | OptionsObjectArray) => {
  if (!options) {
    return undefined;
  }
  const normalizedOptions = [];
  if (Array.isArray(options)) {
    for (const option of options) {
      if (typeof option === "string") {
        normalizedOptions.push({
          label: option,
          value: option,
        });
      } else if (typeof option === "object" && !Array.isArray(option)) {
        normalizedOptions.push({
          label: option.label,
          value: option.value,
          config: option.config || {},
        });
      }
    }
  }
  return normalizedOptions;
};
