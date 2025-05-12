import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, test } from "vitest";
import {
  FormControl,
  FormDescription,
  FormError,
  FormField,
  FormItem,
  FormLabel,
  FormProvider,
} from "./index";

// Test component to use the form components
const TestForm = () => {
  const form = useForm({
    defaultValues: {
      username: "",
    },
    mode: "onChange",
  });
  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(() => {})}>
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <input {...field} data-testid="username-input" />
              </FormControl>
              <FormDescription>Enter your username</FormDescription>
              <FormError>Username is required</FormError>
            </FormItem>
          )}
        />
      </form>
    </FormProvider>
  );
};

// Test component with validation error
const TestFormWithError = () => {
  const form = useForm({
    defaultValues: {
      username: "",
    },
    mode: "onChange",
  });

  // Use useEffect to set the error only once after initial render
  useEffect(() => {
    form.setError("username", { type: "required", message: "Username is required" });
  }, [form]);

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(() => {})}>
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <input {...field} data-testid="username-input" />
              </FormControl>
              <FormDescription>Enter your username</FormDescription>
              <FormError />
            </FormItem>
          )}
        />
      </form>
    </FormProvider>
  );
};

describe("Form Components", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders form components correctly", () => {
    render(<TestForm />);

    expect(screen.getByText("Username")).toBeInTheDocument();
    expect(screen.getByText("Enter your username")).toBeInTheDocument();
    expect(screen.getByTestId("username-input")).toBeInTheDocument();
  });

  test("handles user input", async () => {
    render(<TestForm />);

    const input = screen.getByTestId("username-input");
    await userEvent.type(input, "testuser");

    expect(input).toHaveValue("testuser");
  });

  test("displays error message when form has errors", () => {
    render(<TestFormWithError />);

    expect(screen.getByText("Username is required")).toBeInTheDocument();
  });

  test("FormLabel has error class when there is an error", () => {
    render(<TestFormWithError />);

    const label = screen.getByText("Username");
    expect(label).toHaveClass("text-red-500");
  });

  test("FormDescription has the correct styling", () => {
    render(<TestForm />);

    const description = screen.getByText("Enter your username");
    expect(description).toHaveClass("text-xs");
    expect(description).toHaveClass("text-slate-500");
  });
});
