"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { retryUnlessClientError } from "@/modules/api/lib/v3-client";
import {
  bulkSetMemberAttributes,
  createMemberAttributeKey,
  deleteMemberAttributeKey,
  listAllMemberAttributeRows,
  listMemberAttributeKeys,
  updateMemberAttributeKey,
} from "../lib/api-client";
import type { TBulkMemberAttributeRow } from "../lib/bulk";
import { memberAttributeKeys } from "../lib/query";

/** The organization's attribute keys with their usage. Off when the viewer may not read them. */
export const useMemberAttributeKeys = ({
  organizationId,
  enabled = true,
}: Readonly<{ organizationId: string; enabled?: boolean }>) =>
  useQuery({
    queryKey: memberAttributeKeys.keys(organizationId),
    enabled,
    retry: retryUnlessClientError(2),
    queryFn: ({ signal }) => listMemberAttributeKeys(organizationId, signal),
  });

/** Every member's and pending invite's values, keyed by email for the table. */
export const useMemberAttributeRows = ({
  organizationId,
  enabled = true,
}: Readonly<{ organizationId: string; enabled?: boolean }>) =>
  useQuery({
    queryKey: memberAttributeKeys.rows(organizationId),
    enabled,
    retry: retryUnlessClientError(2),
    queryFn: ({ signal }) => listAllMemberAttributeRows(organizationId, signal),
  });

const useInvalidateMemberAttributes = (organizationId: string) => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: memberAttributeKeys.all(organizationId) });
};

export const useCreateMemberAttributeKey = (organizationId: string) => {
  const invalidate = useInvalidateMemberAttributes(organizationId);
  return useMutation({
    mutationFn: (body: { key: string; label: string; description: string | null }) =>
      createMemberAttributeKey(organizationId, body),
    onSettled: invalidate,
  });
};

export const useUpdateMemberAttributeKey = (organizationId: string) => {
  const invalidate = useInvalidateMemberAttributes(organizationId);
  return useMutation({
    mutationFn: ({
      keyId,
      ...body
    }: {
      keyId: string;
      label: string;
      description: string | null;
      expectedUpdatedAt: string;
    }) => updateMemberAttributeKey(organizationId, keyId, body),
    onSettled: invalidate,
  });
};

export const useDeleteMemberAttributeKey = (organizationId: string) => {
  const invalidate = useInvalidateMemberAttributes(organizationId);
  return useMutation({
    mutationFn: ({ keyId, expectedUpdatedAt }: { keyId: string; expectedUpdatedAt: string }) =>
      deleteMemberAttributeKey(organizationId, keyId, expectedUpdatedAt),
    onSettled: invalidate,
  });
};

export const useBulkSetMemberAttributes = (organizationId: string) => {
  const invalidate = useInvalidateMemberAttributes(organizationId);
  return useMutation({
    mutationFn: (rows: TBulkMemberAttributeRow[]) => bulkSetMemberAttributes(organizationId, rows),
    onSettled: invalidate,
  });
};
