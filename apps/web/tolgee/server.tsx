import { createServerInstance } from "@tolgee/react/server";
import { getLocale } from "./language";
import { TolgeeBase } from "./shared";

let branchName: string;

try {
  branchName = process.env.NODE_ENV === "development" ? require("../../../branch.json").branchName : "main";
} catch (error) {
  branchName = "main"; // Fallback value
}
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
