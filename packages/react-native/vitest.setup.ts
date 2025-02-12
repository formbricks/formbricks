import { afterEach, beforeEach, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

// Mock react-native
vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

// Mock react-native-webview
vi.mock("react-native-webview", () => ({
  WebView: vi.fn(),
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));
