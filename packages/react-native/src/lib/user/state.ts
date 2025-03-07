import { RNConfig } from "@/lib/common/config";
import type { TUserState } from "@/types/config";

let userStateSyncIntervalId: number | null = null;

export const DEFAULT_USER_STATE_NO_USER_ID: TUserState = {
  expiresAt: null,
  data: {
    userId: null,
    contactId: null,
    segments: [],
    displays: [],
    responses: [],
    lastDisplayAt: null,
  },
} as const;

/**
 * Add a listener to check if the user state has expired with a certain interval
 */
export const addUserStateExpiryCheckListener = (): void => {
  const config = RNConfig.getInstance();
  const updateInterval = 1000 * 60; // every 60 seconds

  if (userStateSyncIntervalId === null) {
    const intervalHandler = (): void => {
      const userId = config.get().user.data.userId;

      if (!userId) {
        return;
      }

      // extend the personState validity by 30 minutes:
      config.update({
        ...config.get(),
        user: {
          ...config.get().user,
          expiresAt: new Date(new Date().getTime() + 1000 * 60 * 30), // 30 minutes
        },
      });
    };

    userStateSyncIntervalId = setInterval(intervalHandler, updateInterval) as unknown as number;
  }
};

/**
 * Clear the person state expiry check listener
 */
export const clearUserStateExpiryCheckListener = (): void => {
  if (userStateSyncIntervalId) {
    clearInterval(userStateSyncIntervalId);
    userStateSyncIntervalId = null;
  }
};
