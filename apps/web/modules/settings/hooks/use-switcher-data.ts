"use client";

import { type QueryKey, type UseQueryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { logger } from "@formbricks/logger";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { organizationListQueryOptions } from "@/modules/organization/lib/organizations-query";
import { workspaceListQueryOptions } from "@/modules/workspaces/lib/workspaces-query";

export interface SwitcherItem {
  id: string;
  name: string;
}

/**
 * How long a switcher list is served from the cache. The lists change rarely — a workspace created here
 * invalidates its organization's lists, and a rename invalidates through `reloadKey` — and the sidebar,
 * the breadcrumbs and the settings sidebar all read the same entry, so opening one after another costs
 * one request, not one each.
 */
export const SWITCHER_STALE_TIME_MS = 5 * 60_000;

type TSwitcherOptions = {
  /** Already-translated message shown when the request fails without a message of its own. */
  fallbackError: string;
  /** For consumers that report load failures (e.g. to Sentry). Called once per failure. */
  onError?: (message: string) => void;
  /**
   * A value that, when it changes, marks the cached list stale. Pass the current item's name, so a rename
   * (followed by router.refresh) doesn't leave the old name in the list.
   */
  reloadKey?: string;
};

const sortByName = (items: SwitcherItem[]) => [...items].sort((a, b) => a.name.localeCompare(b.name));

/**
 * The shared loader behind the organization and workspace switchers: nothing is fetched until the dropdown
 * first opens (`load`), the list comes back sorted by name, and a failure surfaces as a translated
 * message with a `retry`. The data lives in the TanStack cache, so every switcher on the page shares it.
 */
const useSwitcherData = <TKey extends QueryKey>(
  listQuery: UseQueryOptions<SwitcherItem[], Error, SwitcherItem[], TKey>,
  { fallbackError, onError, reloadKey }: TSwitcherOptions
) => {
  const queryClient = useQueryClient();
  const [isRequested, setIsRequested] = useState(false);
  const { queryKey } = listQuery;
  const query = useQuery({
    ...listQuery,
    enabled: isRequested,
    staleTime: SWITCHER_STALE_TIME_MS,
    select: sortByName,
  });

  // A retry with nothing cached puts the query back to pending, so the dropdown shows a spinner, not both.
  const error = query.error ? getV3ApiErrorMessage(query.error, fallbackError) : null;

  // The latest callback, message and key, held in a ref so callers can pass inline closures and fresh
  // arrays without re-running the effects below on every render. Written in an effect, not during render:
  // a ref written while rendering is state the renderer may discard (ENG-2366). Effects run in order, so
  // the ones below always read this render's values.
  const latest = useRef({ onError, fallbackError, queryKey });
  useEffect(() => {
    latest.current = { onError, fallbackError, queryKey };
  });

  useEffect(() => {
    if (!query.error) return;
    // The callback only gets the translated message, so the raw failure survives in the log alone.
    logger.error(query.error, "Switcher data load failed");
    latest.current.onError?.(getV3ApiErrorMessage(query.error, latest.current.fallbackError));
  }, [query.error]);

  const lastReloadKey = useRef(reloadKey);
  useEffect(() => {
    if (lastReloadKey.current === reloadKey) return;
    lastReloadKey.current = reloadKey;
    void queryClient.invalidateQueries({ queryKey: latest.current.queryKey });
  }, [reloadKey, queryClient]);

  const load = useCallback(() => setIsRequested(true), []);
  const { refetch } = query;
  const retry = useCallback(() => {
    setIsRequested(true);
    void refetch();
  }, [refetch]);

  return {
    items: query.data ?? [],
    // The first load, or a retry after a failure: pending with a request in flight.
    isLoading: query.isLoading,
    error,
    // True once a load has completed, failed or not, so callers can tell "never opened" from "empty".
    hasLoaded: query.isFetched,
    load,
    retry,
  };
};

/** The caller's organizations, for the organization switcher. */
export const useOrganizationSwitcherData = (options: TSwitcherOptions) =>
  useSwitcherData(organizationListQueryOptions(), options);

/** The caller's workspaces in the organization, for the workspace switcher. */
export const useWorkspaceSwitcherData = (organizationId: string, options: TSwitcherOptions) =>
  useSwitcherData(workspaceListQueryOptions(organizationId), options);
