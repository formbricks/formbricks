import { prisma } from "@formbricks/database";

const NEXT_AUTH_SESSION_COOKIE_NAMES = [
  "__Secure-next-auth.session-token",
  "next-auth.session-token",
] as const;

type TCookieStore = {
  get: (name: string) => { value: string } | undefined;
};

type TRequestWithCookies = {
  cookies: TCookieStore;
};

export const getSessionTokenFromRequest = (request: TRequestWithCookies): string | null => {
  for (const cookieName of NEXT_AUTH_SESSION_COOKIE_NAMES) {
    const cookie = request.cookies.get(cookieName);
    if (cookie?.value) {
      return cookie.value;
    }
  }

  return null;
};

export const getProxySession = async (request: TRequestWithCookies) => {
  const sessionToken = getSessionTokenFromRequest(request);

  if (!sessionToken) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: {
      sessionToken,
    },
    select: {
      userId: true,
      expires: true,
      user: {
        select: {
          isActive: true,
        },
      },
    },
  });

  if (!session || session.expires <= new Date() || session.user.isActive === false) {
    return null;
  }

  return session;
};
