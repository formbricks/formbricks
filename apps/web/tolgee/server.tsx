import { createServerInstance } from "@tolgee/react/server";
import branch from "../../../branch.json";
import { getLocale } from "./language";
import { TolgeeBase } from "./shared";

export const { getTolgee, getTranslate, T } = createServerInstance({
  getLocale: getLocale,
  createTolgee: async (language) => {
    return TolgeeBase().init({
      tagNewKeys: [`draft:${branch.branchName}`],
      observerOptions: {
        fullKeyEncode: true,
      },
      language,
    });
  },
});
