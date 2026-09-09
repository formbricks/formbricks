import { vi } from "vitest";

export const loggerMocks = {
  debug: vi.fn(),
  warn: vi.fn(),
};

vi.mock("@formbricks/logger", () => ({
  logger: loggerMocks,
}));
