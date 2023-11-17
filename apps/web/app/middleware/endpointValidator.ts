export const loginRoute = (url: string) => url === "/api/auth/callback/credentials";

export const signupRoute = (url: string) => url === "/api/v1/users";

export const clientSideApiRoute = (url: string): boolean => {
  if (url.includes("/api/v1/js/actions")) return true;
  if (url.includes("/api/v1/client/storage")) return true;
  const regex = /^\/api\/v\d+\/client\//;
  return regex.test(url);
};
