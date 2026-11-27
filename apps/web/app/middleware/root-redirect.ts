import { readInstanceSetupState } from "@/lib/instance/setup-state";

/**
 * Where `/` sends a visitor without a session: the setup intro on an instance that has never been set
 * up, login otherwise. Proxy calls it so the redirect leaves before anything renders; `app/page.tsx`
 * calls it as the fallback. A `redirect()` thrown while the page renders ships the root layout and its
 * RSC payload as the 307's body, which scanners report as a redirect leaking content (CWE-201).
 *
 * The same rule as `getIsFreshInstance` (`readInstanceSetupState`), read directly because that function is
 * `server-only` and React-cached, both made for the render tree rather than proxy; and read-only, so proxy
 * never writes the marker.
 */
export const getUnauthenticatedRootRedirectPath = async (): Promise<"/setup/intro" | "/auth/login"> =>
  (await readInstanceSetupState()) === "fresh" ? "/setup/intro" : "/auth/login";
