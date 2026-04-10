import { vi } from "vitest";

vi.mock("isomorphic-dompurify", () => {
  const sanitize = vi.fn((value: string) => value);
  return {
    sanitize,
    default: {
      sanitize,
    },
  };
});

// mock react-i18next useTranslation on components
vi.mock("react-i18next", async () => {
  const actual = await vi.importActual<typeof import("react-i18next")>("react-i18next");

  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
      i18n: {
        changeLanguage: vi.fn(),
      },
    }),
  };
});
