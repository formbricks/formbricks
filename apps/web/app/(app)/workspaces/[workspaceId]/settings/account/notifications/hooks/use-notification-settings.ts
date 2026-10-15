"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TNotificationSettingPatchBody } from "@/app/api/internal/users/me/schemas";
import { updateNotificationSetting } from "../lib/api-client";
import { notificationSettingsKeys, notificationSettingsQueryOptions } from "../lib/query";

export const useNotificationSettings = () => useQuery(notificationSettingsQueryOptions());

/**
 * Flip one switch. The server applies it to the stored settings and answers with all of them, which
 * replaces the cache — so a second switch flipped meanwhile is never undone by a stale copy.
 */
export const useUpdateNotificationSetting = () => {
  const queryClient = useQueryClient();
  const queryKey = notificationSettingsKeys.mine();
  return useMutation({
    mutationFn: (toggle: TNotificationSettingPatchBody) => updateNotificationSetting(toggle),
    onMutate: () => queryClient.cancelQueries({ queryKey }),
    onSuccess: (settings) => queryClient.setQueryData(queryKey, settings),
    onError: () => queryClient.invalidateQueries({ queryKey }),
  });
};
