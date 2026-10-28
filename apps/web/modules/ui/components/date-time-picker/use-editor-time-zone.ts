"use client";

import { useSyncExternalStore } from "react";
import { getEditorTimeZone } from "./lib/date-time";

const subscribeToNothing = () => () => {};

/**
 * The editor's IANA time zone, or null while rendering on the server and during hydration.
 *
 * The server's zone is not the editor's, so anything that formats a time or names the zone has to wait
 * for the browser; rendering it on the server would print the wrong zone and then fail to hydrate.
 */
export const useEditorTimeZone = (): string | null =>
  useSyncExternalStore(subscribeToNothing, getEditorTimeZone, () => null);
