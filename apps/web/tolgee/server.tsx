import { createServerInstance } from "@tolgee/react/server";
import { getLocale } from "./language";
import { TolgeeBase } from "./shared";

// Try to import branch.json, but handle the case where it doesn't exist
let branchName: string | undefined;
try {
  const branch = require("../../../branch.json");
  branchName = branch.branchName;
} catch (e) {
  // File doesn't exist in production, so we'll use undefined
  branchName = undefined;
}

export const { getTolgee, getTranslate, T } = createServerInstance({
  getLocale: getLocale,
  createTolgee: async (language) => {
    return TolgeeBase().init({
      tagNewKeys: branchName ? [`draft:${branchName}`] : [],
      observerOptions: {
        fullKeyEncode: true,
      },
      language,
    });
  },
});
