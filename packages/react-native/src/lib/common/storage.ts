import AsyncStorageModule from "@react-native-async-storage/async-storage";

const AsyncStorageWithDefault = AsyncStorageModule as typeof AsyncStorageModule & {
  default?: typeof AsyncStorageModule;
};

const AsyncStorage = AsyncStorageWithDefault.default ?? AsyncStorageModule;

export { AsyncStorage };
