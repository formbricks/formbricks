import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TwoFactor } from "./two-factor";

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

const TestWrapper = () => {
  const form = useForm<FormValues>({
    defaultValues: {
      email: "",
      password: "",
    },
  });

  return (
    <FormProvider {...form}>
      <TwoFactor form={form} />
    </FormProvider>
  );
};

describe("TwoFactor", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders OTP input fields", () => {
    render(<TestWrapper />);
    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(6);
    inputs.forEach((input) => {
      expect(input).toHaveAttribute("inputmode", "numeric");
      expect(input).toHaveAttribute("maxlength", "6");
      expect(input).toHaveAttribute("pattern", "\\d{1}");
    });
  });
});
