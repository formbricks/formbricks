"use client";

import { type ReactNode, createContext, useContext } from "react";
import type { TCreativesAccess } from "../lib/access-rules";

const CreativesAccessContext = createContext<TCreativesAccess | null>(null);

/**
 * The workspace's Creatives access level (ENG-6602) for the client components outside the Creatives
 * pages: the survey screens' creative UI shows in `full` and `windDown` and links to the editor only in
 * `full`. The workspace layouts decide it on the server with `getCreativesAccess` and mount this.
 */
export const CreativesAccessProvider = ({
  access,
  children,
}: Readonly<{ access: TCreativesAccess; children: ReactNode }>) => (
  <CreativesAccessContext.Provider value={access}>{children}</CreativesAccessContext.Provider>
);

export const useCreativesAccess = (): TCreativesAccess => {
  const access = useContext(CreativesAccessContext);
  if (access === null) {
    throw new Error("useCreativesAccess must be used within a CreativesAccessProvider");
  }
  return access;
};
