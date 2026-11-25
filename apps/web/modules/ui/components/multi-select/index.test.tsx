import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { MultiSelect } from "./index";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const flush = () => new Promise((resolve) => queueMicrotask(() => resolve(undefined)));

const renderField = (onChange: (values: string[]) => void, splitOnSeparators = true) =>
  render(
    <MultiSelect
      inputId="country"
      value={[] as string[]}
      options={[]}
      onChange={onChange}
      creatable
      splitOnSeparators={splitOnSeparators}
      maxSelected={3}
    />
  );

describe("MultiSelect separators (ENG-7248)", () => {
  afterEach(cleanup);

  test("a typed comma or semicolon ends a value", async () => {
    const onChange = vi.fn();
    renderField(onChange);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "Sweden," } });
    await flush();
    expect(onChange).toHaveBeenLastCalledWith(["Sweden"]);
    expect((input as HTMLInputElement).value).toBe("");
  });

  test("pasted text with separators becomes one chip per value, up to the cap, without repeats", async () => {
    const onChange = vi.fn();
    renderField(onChange);
    const input = screen.getByRole("combobox");
    fireEvent.paste(input, {
      clipboardData: { getData: () => "Denmark; Finland, denmark; Norway; Iceland" },
    });
    await flush();
    expect(onChange).toHaveBeenLastCalledWith(["Denmark", "Finland", "Norway"]);
  });

  test("leaves typing alone without splitOnSeparators", async () => {
    const onChange = vi.fn();
    renderField(onChange, false);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "Washington, D.C." } });
    await flush();
    expect(onChange).not.toHaveBeenCalled();
    expect((input as HTMLInputElement).value).toBe("Washington, D.C.");
  });
});
