import { createServerInstance } from "@tolgee/react/server";
import { branchName } from "../../../branch.json";
import { getLocale } from "./language";
import { TolgeeBase } from "./shared";

export const { getTolgee, getTranslate, T } = createServerInstance({
  getLocale: getLocale,
  createTolgee: async (language) => {
    return TolgeeBase().init({
      tagNewKeys: [`draft: ${branchName}`],
      observerOptions: {
        fullKeyEncode: true,
      },
      language,
    });
  },
});
