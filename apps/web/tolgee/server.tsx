import { createServerInstance } from "@tolgee/react/server";
import { getLocale } from "./language";
import { TolgeeBase } from "./shared";

let branchName: string;

try {
  branchName = require("../../../branch.json").branchName;
} catch (error) {
  console.warn("branch.json not found, using default branch name.");
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
