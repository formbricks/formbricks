"use client";

import { useQuery } from "@tanstack/react-query";
import { getRetentionHealth } from "../lib/api-client";
import { retentionHealthKeys } from "../lib/query";

/** What can keep data retention from working for the organisation. Owners and managers only. */
export const useRetentionHealth = ({ organizationId }: Readonly<{ organizationId: string }>) =>
  useQuery({
    queryKey: retentionHealthKeys.detail(organizationId),
    queryFn: ({ signal }) => getRetentionHealth({ organizationId, signal }),
  });
