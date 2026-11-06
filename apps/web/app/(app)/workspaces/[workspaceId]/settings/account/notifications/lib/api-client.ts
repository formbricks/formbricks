import type { TUserNotificationSettings } from "@formbricks/types/user";
import type { TNotificationSettingPatchBody } from "@/app/api/internal/users/me/schemas";
import { getApiData, sendApiRequest } from "@/modules/api/lib/internal-api-client";

const BASE_PATH = "/api/internal/users/me/notification-settings";

export const getNotificationSettings = ({ signal }: { signal?: AbortSignal } = {}) =>
  getApiData<TUserNotificationSettings>(BASE_PATH, { signal });

/** Flip one switch. Answers with every switch, as stored. */
export const updateNotificationSetting = (toggle: TNotificationSettingPatchBody) =>
  sendApiRequest<TUserNotificationSettings>(BASE_PATH, { method: "PATCH", body: toggle });
