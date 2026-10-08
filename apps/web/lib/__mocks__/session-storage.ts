import { vi } from "vitest";

/** In-memory stand-in for the `sessionStorage` methods the churn-survey marker uses. */
export const createStorage = (initial: Record<string, string> = {}) => {
  const items = new Map(Object.entries(initial));
  return {
    getItem: vi.fn((key: string) => items.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => void items.set(key, value)),
    removeItem: vi.fn((key: string) => void items.delete(key)),
  };
};
