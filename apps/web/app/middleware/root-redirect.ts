import { prisma } from "@formbricks/database";

/**
 * Where `/` sends a visitor without a session: the setup intro on an instance with no users yet, login
 * otherwise. Proxy calls it so the redirect leaves before anything renders; `app/page.tsx` calls it as
 * the fallback. A `redirect()` thrown while the page renders ships the root layout and its RSC payload
 * as the 307's body, which scanners report as a redirect leaking content (CWE-201).
 *
 * The user lookup is `getIsFreshInstance` (`lib/instance/service.ts`) restated, because that module is
 * `server-only` and wrapped in React `cache()`, both made for the render tree rather than proxy.
 */
export const getUnauthenticatedRootRedirectPath = async (): Promise<"/setup/intro" | "/auth/login"> => {
  const existingUser = await prisma.user.findFirst({ select: { id: true } });
  return existingUser ? "/auth/login" : "/setup/intro";
};
