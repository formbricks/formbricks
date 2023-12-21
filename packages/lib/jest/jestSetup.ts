// mock these globally used functions

jest.mock("next/cache", () => ({
  __esModule: true,
  unstable_cache: (fn: () => {}) => {
    return async () => {
      return fn();
    };
  },
  revalidateTag: jest.fn(),
}));

jest.mock("server-only", () => jest.fn());

beforeEach(() => {
  jest.resetModules();
  jest.resetAllMocks();
});

afterEach(() => {
  jest.clearAllMocks();
});
