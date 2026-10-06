"use client";

import {
  ServerActionFailureNotice,
  useServerActionFailures,
} from "@/modules/ui/components/server-action-failure-notice";
import { StaleDeploymentPrompt, useIsStaleDeployment } from "@/modules/ui/components/stale-deployment-prompt";

/**
 * The corner where notices about server actions that could not complete appear.
 *
 * Mounted once in the root layout: a server action can fail from any route, including ones that mount
 * no `Toaster`, so these render their own surface rather than a toast. Sharing one region stacks the
 * notices instead of letting them overlap when both are up at once.
 *
 * The region exists only while a notice is showing. A modal dialog marks every element already in
 * `<body>` aria-hidden when it opens (Radix uses `aria-hidden`'s `hideOthers`), and an alert added
 * inside a hidden node is never announced -- so an always-mounted region would silence a failure
 * raised from inside a dialog. Mounting it on demand means it arrives after the dialog did.
 */
export const ServerActionNotices = () => {
  const isStale = useIsStaleDeployment();
  const failures = useServerActionFailures();

  if (!isStale && !failures.isVisible) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-100 flex flex-col items-center gap-3 px-4 py-6 sm:items-end sm:p-6">
      {isStale && <StaleDeploymentPrompt />}
      {failures.isVisible && (
        <ServerActionFailureNotice
          key={failures.failureCount}
          restoreFocus={failures.restoreFocus}
          onDismiss={failures.dismiss}
        />
      )}
    </div>
  );
};
