"use client";

import { useEffect, useState } from "react";
import { isNewerVersion } from "@/app/(app)/workspaces/[workspaceId]/lib/utils";
import { getLatestRelease } from "@/modules/workspaces/settings/(setup)/app-connection/lib/api-client";
import packageJson from "../../../../../package.json";

/**
 * Tag of the latest stable Formbricks release, but only when it is newer than the running build.
 * Empty string means "nothing to advertise" — either the check hasn't resolved, it failed, or this
 * instance is already up to date.
 *
 * Only fetched for an owner/manager, since nobody else is shown the update prompt and nobody else
 * could act on it.
 *
 * Extracted from MainNavigation rather than inlined: the nested fetch-then-compare put three levels
 * of branching inside an effect inside the component, which was most of what kept that component
 * over the cognitive-complexity limit Sonar enforces (ENG-3076).
 */
export const useLatestStableRelease = (isOwnerOrManager: boolean): string => {
  const [latestVersion, setLatestVersion] = useState("");

  useEffect(() => {
    if (!isOwnerOrManager) {
      return;
    }

    // Abort the request when the role changes or the component unmounts, and drop whatever it still
    // answers: a stale result must not overwrite a newer one.
    const controller = new AbortController();

    const loadLatestRelease = async () => {
      let latestVersionTag: string | null;
      try {
        latestVersionTag = await getLatestRelease({ signal: controller.signal });
      } catch {
        // Nothing to advertise when the check fails; the prompt is a convenience.
        return;
      }
      if (controller.signal.aborted || !latestVersionTag) {
        return;
      }

      // Argument order matters: isNewerVersion(current, latest) is true when `latest` is ahead of
      // `current` — see its own tests in ./utils.test.ts.
      if (isNewerVersion(`v${packageJson.version}`, latestVersionTag)) {
        setLatestVersion(latestVersionTag);
      }
    };

    void loadLatestRelease();

    return () => {
      controller.abort();
    };
  }, [isOwnerOrManager]);

  return latestVersion;
};
