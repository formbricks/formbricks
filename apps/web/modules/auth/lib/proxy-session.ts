import { prisma } from "@formbricks/database";
import { getSessionTokenFromCookieStore } from "./session-cookie";

type TCookieStore = {
  get: (name: string) => { value: string } | undefined;
};

type TRequestWithCookies = {
  cookies: TCookieStore;
};

export const getSessionTokenFromRequest = (request: TRequestWithCookies): string | null => {
  return getSessionTokenFromCookieStore(request.cookies);
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
