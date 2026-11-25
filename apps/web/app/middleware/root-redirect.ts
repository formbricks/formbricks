import { prisma } from "@formbricks/database";
import { INSTANCE_SETUP_ID } from "@formbricks/types/instance";

/**
 * Where `/` sends a visitor without a session: the setup intro on an instance that has never been set
 * up, login otherwise. Proxy calls it so the redirect leaves before anything renders; `app/page.tsx`
 * calls it as the fallback. A `redirect()` thrown while the page renders ships the root layout and its
 * RSC payload as the 307's body, which scanners report as a redirect leaking content (CWE-201).
 *
 * The predicate is `getIsFreshInstance` (`lib/instance/service.ts`) restated, because that module is
 * `server-only` and wrapped in React `cache()`, both made for the render tree rather than proxy. Fresh
 * means no setup marker, no user and no organization (ENG-7313): a set-up instance whose users are all
 * gone is not fresh, and its setup pages answer 404. Unlike `getIsFreshInstance` this never writes the
 * marker, so proxy stays read-only. The lookups short-circuit in the order a set-up instance answers
 * soonest: almost every request stops at the marker.
 */
export const getUnauthenticatedRootRedirectPath = async (): Promise<"/setup/intro" | "/auth/login"> => {
  const isSetUp =
    (await prisma.instanceSetup.findUnique({ where: { id: INSTANCE_SETUP_ID }, select: { id: true } })) ??
    (await prisma.user.findFirst({ select: { id: true } })) ??
    (await prisma.organization.findFirst({ select: { id: true } }));
  return isSetUp ? "/auth/login" : "/setup/intro";
};
