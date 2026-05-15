export const NEXT_AUTH_SESSION_COOKIE_NAMES = [
  "__Secure-next-auth.session-token",
  "next-auth.session-token",
] as const;

type TCookieStore = {
  get: (name: string) => { value: string } | undefined;
};

const getCookieValueFromHeader = (cookieHeader: string, cookieName: string): string | null => {
  const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());

  for (const cookie of cookies) {
    if (!cookie.startsWith(`${cookieName}=`)) {
      continue;
    }

    const cookieValue = cookie.slice(cookieName.length + 1);
    return cookieValue.length > 0 ? decodeURIComponent(cookieValue) : null;
  }

  return null;
};

export const getSessionTokenFromCookieStore = (cookieStore: TCookieStore): string | null => {
  for (const cookieName of NEXT_AUTH_SESSION_COOKIE_NAMES) {
    const cookie = cookieStore.get(cookieName);
    if (cookie?.value) {
      return cookie.value;
    }
  }

  return null;
};

export const getSessionTokenFromCookieHeader = (cookieHeader: string | null): string | null => {
  if (!cookieHeader) {
    return null;
  }

  for (const cookieName of NEXT_AUTH_SESSION_COOKIE_NAMES) {
    const cookieValue = getCookieValueFromHeader(cookieHeader, cookieName);
    if (cookieValue) {
      return cookieValue;
    }
  }

  return null;
};
