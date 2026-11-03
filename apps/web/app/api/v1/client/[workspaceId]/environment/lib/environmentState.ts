import "server-only";
import { ErrorCode, createCacheKey } from "@formbricks/cache";
import type { TCreativePayload } from "@formbricks/creatives";
import { prisma } from "@formbricks/database";
import { TJsWorkspaceState } from "@formbricks/types/js";
import {
  addLegacyProjectOverwritesToList,
  addLegacyProjectToEnvironmentState,
} from "@/app/lib/api/api-backwards-compat";
import { cache } from "@/lib/cache";
import { IS_RECAPTCHA_CONFIGURED, POSTHOG_KEY, RECAPTCHA_SITE_KEY } from "@/lib/constants";
import { capturePostHogEvent } from "@/lib/posthog";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { getWorkspaceStateData } from "./data";

/** The environment payload's `data`: the survey state plus the creatives (`@formbricks/creatives`). */
export type TWorkspaceStatePayload = TJsWorkspaceState["data"] & { creatives?: TCreativePayload[] };

type WorkspaceState = { data: TWorkspaceStatePayload };
type OutageEntry = { value: WorkspaceState; expiresAt: number; bytes: number };

const OUTAGE_TTL_MS = 10_000;
const MAX_OUTAGE_ENTRIES = 100;
const MAX_OUTAGE_BYTES = 16 * 1024 * 1024;
const MAX_ENTRY_BYTES = 1024 * 1024;
const outageEntries = new Map<string, OutageEntry>();
const outageLoads = new Map<string, Promise<WorkspaceState>>();
let outageBytes = 0;

const forgetOutageEntry = (workspaceId: string): void => {
  const entry = outageEntries.get(workspaceId);
  if (!entry) return;
  outageEntries.delete(workspaceId);
  outageBytes -= entry.bytes;
};

/** A small per-process fallback; healthy Redis requests never read from it. */
const loadDuringRedisOutage = async (
  workspaceId: string,
  load: () => Promise<WorkspaceState>
): Promise<WorkspaceState> => {
  const now = Date.now();
  const entry = outageEntries.get(workspaceId);
  if (entry) {
    forgetOutageEntry(workspaceId);
    if (entry.expiresAt > now) {
      outageEntries.set(workspaceId, entry);
      outageBytes += entry.bytes;
      return entry.value;
    }
  }

  const pending = outageLoads.get(workspaceId);
  if (pending) return pending;

  const refresh = (async () => {
    const value = await load();
    let bytes: number;
    try {
      bytes = JSON.stringify(value).length * 2;
    } catch {
      return value;
    }
    if (bytes <= MAX_ENTRY_BYTES) {
      while (
        outageEntries.size >= MAX_OUTAGE_ENTRIES ||
        (outageEntries.size > 0 && outageBytes + bytes > MAX_OUTAGE_BYTES)
      ) {
        const oldest = outageEntries.keys().next().value;
        if (!oldest) break;
        forgetOutageEntry(oldest);
      }
      outageEntries.set(workspaceId, { value, expiresAt: Date.now() + OUTAGE_TTL_MS, bytes });
      outageBytes += bytes;
    }
    return value;
  })();

  outageLoads.set(workspaceId, refresh);
  try {
    return await refresh;
  } finally {
    outageLoads.delete(workspaceId);
  }
};

/** Fetch workspace state from Redis, with a bounded local fallback during Redis outages. */
export const getWorkspaceState = async (workspaceId: string): Promise<{ data: TWorkspaceStatePayload }> => {
  const loadState = async (): Promise<WorkspaceState> => {
    // Single optimized database call replacing multiple service calls
    const { workspace, surveys, actionClasses, creatives } = await getWorkspaceStateData(workspaceId);

    // Handle app setup completion update if needed
    // This is a one-time setup flag that can tolerate TTL-based cache expiration
    if (!workspace.appSetupCompleted) {
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: { appSetupCompleted: true },
      });

      if (POSTHOG_KEY) {
        const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);
        capturePostHogEvent(
          workspaceId,
          "app_connected",
          {
            num_surveys: surveys.length,
            num_code_actions: actionClasses.filter((ac) => ac.type === "code").length,
            num_no_code_actions: actionClasses.filter((ac) => ac.type === "noCode").length,
            organization_id: organizationId ?? "",
            workspace_id: workspaceId,
          },
          organizationId ? { organizationId, workspaceId } : undefined
        );
      }
    }

    // The legacy `project` alias below would otherwise repeat the workspace custom CSS (up to 100 KB)
    // in the same response. Only SDKs from before the rename read `project`, and none of them knows
    // custom CSS, so the alias leaves it out and the CSS is sent exactly once (ENG-3552).
    const { customCss: _workspaceCustomCss, ...legacyProjectSettings } = workspace.workspaceSettings;

    // Build the response data
    // Backwards compat: include `project` alongside `workspace`, and
    // `projectOverwrites` alongside `workspaceOverwrites` in each survey
    const data = addLegacyProjectToEnvironmentState({
      surveys: addLegacyProjectOverwritesToList(surveys),
      actionClasses,
      workspace: workspace.workspaceSettings,
      project: legacyProjectSettings,
      ...(IS_RECAPTCHA_CONFIGURED ? { recaptchaSiteKey: RECAPTCHA_SITE_KEY } : {}),
      // ENG-3994: only when there is something to show, so SDKs and cached states from before
      // creatives never meet the key.
      ...(creatives.length > 0 ? { creatives } : {}),
    } as TWorkspaceStatePayload);

    return { data };
  };

  const key = createCacheKey.workspace.state(workspaceId);
  try {
    const cached = await cache.get<WorkspaceState>(key);
    if (cached.ok) {
      forgetOutageEntry(workspaceId);
      if (cached.data !== null) return cached.data;
    }
    if (
      !cached.ok &&
      (cached.error.code === ErrorCode.RedisConnectionError ||
        cached.error.code === ErrorCode.RedisOperationError)
    ) {
      return loadDuringRedisOutage(workspaceId, loadState);
    }
  } catch {
    return loadDuringRedisOutage(workspaceId, loadState);
  }

  const fresh = await loadState();
  try {
    await cache.set(key, fresh, 60 * 1000);
  } catch {
    // The data is already fresh; cache writes are best-effort.
  }
  return fresh;
};
