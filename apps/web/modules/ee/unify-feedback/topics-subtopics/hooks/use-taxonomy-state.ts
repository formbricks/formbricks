"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getTaxonomyState } from "../lib/api-client";
import { type TTaxonomyScopeSelection, taxonomyKeys } from "../lib/query";

/** The active taxonomy tree + recent runs for a field scope. `keepPreviousData` avoids a flash when
 * switching source/field. Disabled until a scope is selected. */
export const useTaxonomyState = ({
  workspaceId,
  scope,
  enabled = true,
}: Readonly<{ workspaceId: string; scope: TTaxonomyScopeSelection | null; enabled?: boolean }>) =>
  useQuery({
    queryKey: taxonomyKeys.state(workspaceId, scope),
    enabled: enabled && scope !== null,
    queryFn: ({ signal }) => {
      if (!scope) {
        throw new Error("scope is required");
      }
      return getTaxonomyState({ workspaceId, ...scope, signal });
    },
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
