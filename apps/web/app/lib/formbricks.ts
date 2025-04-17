import formbricks from "@formbricks/js";
import { FORMBRICKS_LOGGED_IN_WITH_LS } from "@formbricks/lib/localStorage";

export const formbricksLogout = async () => {
  const loggedInWith = localStorage.getItem(FORMBRICKS_LOGGED_IN_WITH_LS);
  localStorage.clear();
  if (loggedInWith) {
    localStorage.setItem(FORMBRICKS_LOGGED_IN_WITH_LS, loggedInWith);
  }
  return await formbricks.logout();
};
