export const loginRoute = (url: string) => url === "/api/auth/callback/credentials";

export const signupRoute = (url: string) => url === "/api/v1/users";

export const clientSideApiRoute = (url: string): boolean => {
  if (url.includes("/api/packages/")) return true;
  if (url.includes("/api/v1/js/actions")) return true;
  if (url.includes("/api/v1/client/storage")) return true;
  const regex = /^\/api\/v\d+\/client\//;
  return regex.test(url);
};

export const shareUrlRoute = (url: string): boolean => {
  const regex = /\/share\/[A-Za-z0-9]+\/(summary|responses)/;
  return regex.test(url);
};

export const isAuthProtectedRoute = (url: string): boolean => {
  // List of routes that require authentication
  const protectedRoutes = ["/environments", "/setup/organization", "/organizations"];

  return protectedRoutes.some((route) => url.startsWith(route));
};
export const isSyncWithUserIdentificationEndpoint = (
  url: string
): { environmentId: string; userId: string } | false => {
  const regex = /\/api\/v1\/client\/([^/]+)\/app\/sync\/([^/]+)/;
  const match = url.match(regex);
  return match ? { environmentId: match[1], userId: match[2] } : false;
};
