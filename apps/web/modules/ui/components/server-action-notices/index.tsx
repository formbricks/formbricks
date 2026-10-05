import { ServerActionFailureNotice } from "@/modules/ui/components/server-action-failure-notice";
import { StaleDeploymentPrompt } from "@/modules/ui/components/stale-deployment-prompt";

/**
 * The corner where notices about server actions that could not complete appear.
 *
 * Mounted once in the root layout: a server action can fail from any route, including ones that
 * mount no `Toaster`, so these render their own surface rather than a toast. Sharing one region
 * stacks the notices instead of letting them overlap when both are up at once.
 */
export const ServerActionNotices = () => (
  <div className="pointer-events-none fixed inset-x-0 bottom-0 z-100 flex flex-col items-center gap-3 px-4 py-6 sm:items-end sm:p-6">
    <StaleDeploymentPrompt />
    <ServerActionFailureNotice />
  </div>
);
