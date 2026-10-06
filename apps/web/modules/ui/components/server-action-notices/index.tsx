"use client";

import { Branch as DismissableLayerBranch } from "@radix-ui/react-dismissable-layer";
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
 * The region itself is the live region, always mounted and empty until a notice arrives, so each
 * notice added to it is announced. It has to carry `aria-live` for a second reason: a modal dialog
 * marks everything else in `<body>` aria-hidden when it opens (Radix uses `aria-hidden`'s
 * `hideOthers`), and `[aria-live]` elements are the ones it leaves exposed -- without that, a notice
 * raised from inside a dialog, or while one is open, would never be read. The notices therefore carry
 * no `role="alert"` of their own, which would have them announced twice.
 *
 * It is also a dismissable-layer branch, as Radix's own toast viewport is: an open dialog, popover or
 * menu treats a click or focus here as inside itself rather than as an outside interaction that closes
 * it. Without that, closing a notice raised by a dialog's Save would close the dialog too and throw
 * away what the user typed. This only works while the package is the same copy the Radix components
 * use (`@radix-ui/react-dialog` pins it exactly), so bump the two together.
 */
export const ServerActionNotices = () => {
  const isStale = useIsStaleDeployment();
  const failures = useServerActionFailures();

  return (
    <DismissableLayerBranch
      aria-live="assertive"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-100 flex flex-col items-center gap-3 px-4 py-6 sm:items-end sm:p-6">
      {isStale && <StaleDeploymentPrompt />}
      {failures.isVisible && (
        <ServerActionFailureNotice
          key={failures.failureCount}
          restoreFocus={failures.restoreFocus}
          onFocusEnter={failures.onFocusEnter}
          onDismiss={failures.dismiss}
        />
      )}
    </DismissableLayerBranch>
  );
};
