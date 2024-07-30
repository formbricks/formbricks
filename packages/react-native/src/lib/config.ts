import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppConfig, RN_ASYNC_STORAGE_KEY, StorageHandler } from "@formbricks/lib/js/config";

const storageHandler: StorageHandler = {
  getItem: async (key: string) => AsyncStorage.getItem(key),
  setItem: async (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: async (key: string) => AsyncStorage.removeItem(key),
};

export const appConfig = AppConfig.getInstance(storageHandler, RN_ASYNC_STORAGE_KEY);
