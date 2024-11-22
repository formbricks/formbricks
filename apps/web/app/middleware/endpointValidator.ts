export const isLoginRoute = (url: string) => url === "/api/auth/callback/credentials";

export const isSignupRoute = (url: string) => url === "/auth/signup";

export const isVerifyEmailRoute = (url: string) => url === "/auth/verify-email";

export const isForgotPasswordRoute = (url: string) => url === "/auth/forgot-password";

export const isClientSideApiRoute = (url: string): boolean => {
  if (url.includes("/api/packages/")) return true;
  if (url.includes("/api/v1/js/actions")) return true;
  if (url.includes("/api/v1/client/storage")) return true;
  const regex = /^\/api\/v\d+\/client\//;
  return regex.test(url);
};

export const isShareUrlRoute = (url: string): boolean => {
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
