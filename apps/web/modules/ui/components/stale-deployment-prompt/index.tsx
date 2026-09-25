"use client";

import { RefreshCwIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { registerStaleServerActionListener } from "@/lib/utils/stale-server-action";
import { Button } from "@/modules/ui/components/button";

/**
 * Prompts the user to reload once their tab has outlived the deployment it was served by.
 *
 * Mounted once in the root layout: a stale bundle can invoke a server action from any route, and
 * this renders its own surface rather than a toast so the prompt does not depend on a `Toaster`
 * being mounted for that route. Reloading is offered rather than done automatically -- the survey
 * editor is the surface this fires on most, and a silent reload there would discard unsaved edits.
 */
export const StaleDeploymentPrompt = () => {
  const { t } = useTranslation();
  const [isStale, setIsStale] = useState(false);

  useEffect(() => registerStaleServerActionListener(() => setIsStale(true)), []);

  if (!isStale) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-100 flex justify-center px-4 py-6 sm:justify-end sm:p-6">
      {/* role="alert" rather than a live region on the wrapper: the prompt mounts with its content
          already in place, which a live region added at the same time does not announce. */}
      <div
        role="alert"
        className="pointer-events-auto w-full max-w-sm rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
        <div className="flex gap-3">
          <RefreshCwIcon className="mt-0.5 size-5 shrink-0 text-slate-500" aria-hidden="true" />
          <div className="flex flex-col items-start gap-3">
            <div>
              <p className="text-sm font-medium text-slate-900">{t("common.app_updated_title")}</p>
              <p className="mt-1 text-sm text-slate-500">{t("common.app_updated_description")}</p>
            </div>
            <Button size="sm" onClick={() => window.location.reload()}>
              {t("common.reload_page")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
