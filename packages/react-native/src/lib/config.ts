import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppConfig, type StorageHandler } from "../../../js-core/src/app/lib/config";
import { RN_ASYNC_STORAGE_KEY } from "../../../js-core/src/shared/constants";

const storageHandler: StorageHandler = {
  getItem: async (key: string) => AsyncStorage.getItem(key),
  setItem: async (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: async (key: string) => AsyncStorage.removeItem(key),
};

export const appConfig = AppConfig.getInstance(storageHandler, RN_ASYNC_STORAGE_KEY);
