"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TNotificationSettingPatchBody } from "@/app/api/internal/users/me/schemas";
import { updateNotificationSetting } from "../lib/api-client";
import { notificationSettingsKeys, notificationSettingsQueryOptions } from "../lib/query";

export const useNotificationSettings = () => useQuery(notificationSettingsQueryOptions());

/**
 * Flip one switch. The server applies it to the stored settings and answers with all of them, which
 * replaces the cache. Flips run one at a time (`scope`): the server's read-modify-write would otherwise let
 * two quick flips race and lose one.
 */
export const useUpdateNotificationSetting = () => {
  const queryClient = useQueryClient();
  const queryKey = notificationSettingsKeys.mine();
  return useMutation({
    mutationFn: (toggle: TNotificationSettingPatchBody) => updateNotificationSetting(toggle),
    scope: { id: "notification-settings" },
    onMutate: () => queryClient.cancelQueries({ queryKey }),
    onSuccess: (settings) => queryClient.setQueryData(queryKey, settings),
    onError: () => queryClient.invalidateQueries({ queryKey }),
  });
};
