import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TwoFactorBackup } from "./two-factor-backup";

const mockUseTranslate = vi.fn(() => ({
  t: (key: string) => key,
}));

vi.mock("@tolgee/react", () => ({
  useTranslate: () => mockUseTranslate(),
}));

type FormValues = {
  email: string;
  password: string;
  totpCode?: string;
  backupCode?: string;
};

const TestComponent = () => {
  const form = useForm<FormValues>({
    defaultValues: {
      email: "",
      password: "",
    },
  });

  return (
    <FormProvider {...form}>
      <TwoFactorBackup form={form} />
    </FormProvider>
  );
};

describe("TwoFactorBackup", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders backup code input field", () => {
    render(<TestComponent />);

    const input = screen.getByPlaceholderText("XXXXX-XXXXX");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("required");
  });
});
