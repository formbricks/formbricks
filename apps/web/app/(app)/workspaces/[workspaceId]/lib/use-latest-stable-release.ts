"use client";

import { useEffect, useState } from "react";
import { isNewerVersion } from "@/app/(app)/workspaces/[workspaceId]/lib/utils";
import { getLatestStableFbReleaseAction } from "@/modules/workspaces/settings/(setup)/app-connection/actions";
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

    const loadLatestRelease = async () => {
      const res = await getLatestStableFbReleaseAction();
      const latestVersionTag = res?.data;
      if (!latestVersionTag) {
        return;
      }

      if (isNewerVersion(`v${packageJson.version}`, latestVersionTag)) {
        setLatestVersion(latestVersionTag);
      }
    };

    void loadLatestRelease();
  }, [isOwnerOrManager]);

  return latestVersion;
};
