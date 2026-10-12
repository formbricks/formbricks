import { prisma } from "@formbricks/database";
import { getSessionTokenFromCookieHeader, getSessionTokenFromCookieStore } from "./session-cookie";

type TCookieStore = {
  get: (name: string) => { value: string } | undefined;
};

type TRequestWithCookies = {
  cookies: TCookieStore;
};

export const getSessionTokenFromRequest = (request: TRequestWithCookies): string | null => {
  return getSessionTokenFromCookieStore(request.cookies);
};

const getActiveSessionByToken = async (sessionToken: string | null) => {
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

export const getProxySession = async (request: TRequestWithCookies) => {
  return getActiveSessionByToken(getSessionTokenFromRequest(request));
};

/** Same lookup as `getProxySession`, for callers that only hold the raw `Cookie` header. */
export const getProxySessionFromCookieHeader = async (cookieHeader: string | null) => {
  return getActiveSessionByToken(getSessionTokenFromCookieHeader(cookieHeader));
};
