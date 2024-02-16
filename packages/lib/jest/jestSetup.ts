// mock these globally used functions
import { ValidationError } from "@formbricks/types/errors";

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

export const testInputValidation = async (service: Function, ...args: any[]): Promise<void> => {
  it("it should throw a ValidationError if the inputs are invalid", async () => {
    await expect(service(...args)).rejects.toThrow(ValidationError);
  });
};
