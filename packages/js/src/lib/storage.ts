import { Config } from "@formbricks/types/js";

export const retrieveConfig = () => {
  localStorage.getItem("formbricks__config");
};

export const persistConfig = (config: Config) => {
  localStorage.setItem("formbricks__config", JSON.stringify(config));
};
