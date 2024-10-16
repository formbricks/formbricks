import formbricks from "@formbricks/js";
import { env } from "@formbricks/lib/env";
import { FORMBRICKS_LOGGED_IN_WITH_LS } from "@formbricks/lib/localStorage";

export const formbricksEnabled =
  typeof env.NEXT_PUBLIC_FORMBRICKS_API_HOST && env.NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID;

export const formbricksLogout = async () => {
  const loggedInWith = localStorage.getItem(FORMBRICKS_LOGGED_IN_WITH_LS);
  localStorage.clear();
  if (loggedInWith) {
    localStorage.setItem(FORMBRICKS_LOGGED_IN_WITH_LS, loggedInWith);
  }
  return await formbricks.logout();
};
