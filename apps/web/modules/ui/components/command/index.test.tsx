import { CommandDialog, CommandSeparator, CommandShortcut } from "@/modules/ui/components/command/index";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from ".";

window.HTMLElement.prototype.scrollIntoView = vi.fn();

afterEach(() => {
  cleanup();
});

describe("Command", () => {
  test("should filter items based on input", () => {
    render(
      <Command>
        <CommandInput placeholder="Search..." />
        <CommandList>
          <CommandGroup heading="Fruits">
            <CommandItem>Apple</CommandItem>
            <CommandItem>Banana</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    );

    const input = screen.getByPlaceholderText("Search...");
    fireEvent.change(input, { target: { value: "Apple" } });

    expect(screen.getByText("Apple")).toBeInTheDocument();
    expect(screen.queryByText("Banana")).toBeNull();
  });

  test("should display a message when no items match the filter", () => {
    render(
      <Command>
        <CommandInput placeholder="Search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Fruits">
            <CommandItem>Apple</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    );

    const input = screen.getByPlaceholderText("Search...");
    fireEvent.change(input, { target: { value: "Banana" } });

    expect(screen.getByText("No results found.")).toBeInTheDocument();
  });

  test("should handle item selection", async () => {
    const onSelect = vi.fn();

    render(
      <Command>
        <CommandInput placeholder="Search..." />
        <CommandList>
          <CommandGroup heading="Fruits">
            <CommandItem onSelect={onSelect} value="apple">
              Apple
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    );

    const input = screen.getByPlaceholderText("Search...");
    fireEvent.change(input, { target: { value: "Apple" } });

    const item = screen.getByText("Apple");
    fireEvent.click(item);

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalled();
    });
  });

  test("should navigate items with arrow keys", () => {
    const onSelect = vi.fn();
    render(
      <Command>
        <CommandInput placeholder="Search..." />
        <CommandList>
          <CommandGroup heading="Fruits">
            <CommandItem onSelect={onSelect} value="apple">
              Apple
            </CommandItem>
            <CommandItem onSelect={() => {}} value="banana">
              Banana
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    );

    const input = screen.getByPlaceholderText("Search...");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    const appleElement = screen.getByText("Apple");
    fireEvent.click(appleElement);

    expect(onSelect).toHaveBeenCalled();
  });

  test("should not select disabled items", async () => {
    const onSelect = vi.fn();
    render(
      <Command>
        <CommandInput placeholder="Search..." />
        <CommandList>
          <CommandGroup heading="Fruits">
            <CommandItem onSelect={onSelect} disabled value="apple">
              Apple
            </CommandItem>
            <CommandItem value="banana">Banana</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    );

    const input = screen.getByPlaceholderText("Search...");
    fireEvent.change(input, { target: { value: "Apple" } });

    const item = screen.getByText("Apple");
    fireEvent.click(item);

    await waitFor(() => {
      expect(onSelect).not.toHaveBeenCalled();
    });
  });
});

describe("CommandDialog", () => {
  test("should render a dialog with a command palette", () => {
    render(
      <CommandDialog open>
        <CommandInput placeholder="Search..." />
        <CommandList>
          <CommandGroup heading="Fruits">
            <CommandItem>Apple</CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
  });
});

describe("CommandShortcut", () => {
  test("should render a shortcut", () => {
    render(<CommandShortcut>⌘C</CommandShortcut>);
    expect(screen.getByText("⌘C")).toBeInTheDocument();
  });
});

describe("CommandSeparator", () => {
  test("should render a separator", () => {
    const { container } = render(
      <Command>
        <CommandList>
          <CommandSeparator />
        </CommandList>
      </Command>
    );
    const separator = container.querySelector('[data-slot="command-separator"]');
    expect(separator).toBeInTheDocument();
    expect(separator).toHaveClass("bg-border -mx-1 h-px");
  });
});
