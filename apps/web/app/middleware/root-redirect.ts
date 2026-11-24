import { prisma } from "@formbricks/database";

/**
 * Where `/` sends a visitor without a session: the setup intro on an instance with no users yet, login
 * otherwise — the same choice `app/page.tsx` makes.
 *
 * Proxy makes it so the redirect leaves before anything renders. A `redirect()` thrown while the page
 * renders still ships the root layout and its RSC payload as the body of the 307, which scanners report
 * as a redirect leaking content (CWE-201).
 */
export const getUnauthenticatedRootRedirectPath = async (): Promise<"/setup/intro" | "/auth/login"> => {
  const existingUser = await prisma.user.findFirst({ select: { id: true } });
  return existingUser ? "/auth/login" : "/setup/intro";
};
