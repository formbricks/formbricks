import { createServerInstance } from "@tolgee/react/server";
import { getLocale } from "./language";
import { TolgeeBase } from "./shared";

// Handle branch.json which is only available in dev environment
const getBranchTag = () => {
  try {
    // Dynamic import with require to avoid build errors in production
    const branch =
      process.env.NODE_ENV === "development" ? require("../../../branch.json") : { branchName: "main" }; // Default fallback for production

    return `draft:${branch.branchName}`;
  } catch (e) {
    // Fallback if file doesn't exist
    return "draft:main";
  }
};

export const { getTolgee, getTranslate, T } = createServerInstance({
  getLocale: getLocale,
  createTolgee: async (language) => {
    return TolgeeBase().init({
      tagNewKeys: [getBranchTag()],
      observerOptions: {
        fullKeyEncode: true,
      },
      language,
    });
  },
});
