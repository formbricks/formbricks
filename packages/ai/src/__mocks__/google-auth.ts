import { vi } from "vitest";

vi.mock("google-auth-library", () => ({
  GoogleAuth: class {
    getClient() {
      return Promise.resolve({ getAccessToken: () => Promise.resolve({ token: "test-token" }) });
    }
  },
}));
