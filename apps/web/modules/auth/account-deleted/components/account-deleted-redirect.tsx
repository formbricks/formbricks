"use client";

import { useEffect } from "react";

interface AccountDeletedRedirectProps {
  redirectUrl: string;
}

/**
 * Performs the post-deletion redirect from the browser, so the destination never has to survive Better
 * Auth's `originCheck` on the emailed callback link (ENG-3260). `replace` rather than `assign`: the
 * callback URL it came from is single-use, so leaving it in history only offers the visitor a dead link.
 *
 * Renders nothing — the surrounding page is what a visitor without JavaScript is left with, which is why
 * it carries the confirmation text and a link of its own.
 */
export const AccountDeletedRedirect = ({ redirectUrl }: Readonly<AccountDeletedRedirectProps>) => {
  useEffect(() => {
    globalThis.location.replace(redirectUrl);
  }, [redirectUrl]);

  return null;
};
