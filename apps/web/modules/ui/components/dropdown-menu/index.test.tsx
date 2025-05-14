import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./index";

describe("Dropdown Menu Component", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders basic dropdown menu with trigger and content", async () => {
    const user = userEvent.setup();

    render(
      <DropdownMenu>
        <DropdownMenuTrigger data-testid="trigger">Menu Trigger</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem data-testid="menu-item">Menu Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    const trigger = screen.getByTestId("trigger");
    expect(trigger).toBeInTheDocument();
    await user.click(trigger);

    const menuItem = screen.getByTestId("menu-item");
    expect(menuItem).toBeInTheDocument();
  });

  test("renders dropdown menu with groups", async () => {
    const user = userEvent.setup();

    render(
      <DropdownMenu>
        <DropdownMenuTrigger data-testid="trigger">Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuGroup data-testid="menu-group">
            <DropdownMenuItem>Item 1</DropdownMenuItem>
            <DropdownMenuItem>Item 2</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    const trigger = screen.getByTestId("trigger");
    await user.click(trigger);

    expect(screen.getByTestId("menu-group")).toBeInTheDocument();
  });

  test("renders dropdown menu with label", async () => {
    const user = userEvent.setup();

    render(
      <DropdownMenu>
        <DropdownMenuTrigger data-testid="trigger">Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel data-testid="menu-label">Label</DropdownMenuLabel>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    const trigger = screen.getByTestId("trigger");
    await user.click(trigger);

    expect(screen.getByTestId("menu-label")).toBeInTheDocument();
  });

  test("renders dropdown menu with inset label", async () => {
    const user = userEvent.setup();

    render(
      <DropdownMenu>
        <DropdownMenuTrigger data-testid="trigger">Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel inset data-testid="menu-label-inset">
            Inset Label
          </DropdownMenuLabel>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    const trigger = screen.getByTestId("trigger");
    await user.click(trigger);

    expect(screen.getByTestId("menu-label-inset")).toBeInTheDocument();
  });

  test("renders dropdown menu with separator", async () => {
    const user = userEvent.setup();

    render(
      <DropdownMenu>
        <DropdownMenuTrigger data-testid="trigger">Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item 1</DropdownMenuItem>
          <DropdownMenuSeparator data-testid="menu-separator" />
          <DropdownMenuItem>Item 2</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    const trigger = screen.getByTestId("trigger");
    await user.click(trigger);

    expect(screen.getByTestId("menu-separator")).toBeInTheDocument();
  });

  test("renders dropdown menu with shortcut", async () => {
    const user = userEvent.setup();

    render(
      <DropdownMenu>
        <DropdownMenuTrigger data-testid="trigger">Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>
            Item
            <DropdownMenuShortcut data-testid="menu-shortcut">⌘K</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    const trigger = screen.getByTestId("trigger");
    await user.click(trigger);

    expect(screen.getByTestId("menu-shortcut")).toBeInTheDocument();
  });

  test("renders dropdown menu with shortcut with dangerouslySetInnerHTML", async () => {
    const user = userEvent.setup();

    render(
      <DropdownMenu>
        <DropdownMenuTrigger data-testid="trigger">Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>
            Item
            <DropdownMenuShortcut
              data-testid="menu-shortcut-html"
              dangerouslySetInnerHTML={{ __html: "&#8984;K" }}
            />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    const trigger = screen.getByTestId("trigger");
    await user.click(trigger);

    expect(screen.getByTestId("menu-shortcut-html")).toBeInTheDocument();
  });

  test("renders dropdown menu with checkbox item", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();

    render(
      <DropdownMenu>
        <DropdownMenuTrigger data-testid="trigger">Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuCheckboxItem
            checked={true}
            onCheckedChange={onCheckedChange}
            data-testid="menu-checkbox">
            Checkbox Item
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    const trigger = screen.getByTestId("trigger");
    await user.click(trigger);

    const checkbox = screen.getByTestId("menu-checkbox");
    expect(checkbox).toBeInTheDocument();
    await user.click(checkbox);

    expect(onCheckedChange).toHaveBeenCalled();
  });

  test("renders dropdown menu with radio group and radio items", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(
      <DropdownMenu>
        <DropdownMenuTrigger data-testid="trigger">Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup value="option1" onValueChange={onValueChange}>
            <DropdownMenuRadioItem value="option1" data-testid="radio-1">
              Option 1
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="option2" data-testid="radio-2">
              Option 2
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    const trigger = screen.getByTestId("trigger");
    await user.click(trigger);

    expect(screen.getByTestId("radio-1")).toBeInTheDocument();
    expect(screen.getByTestId("radio-2")).toBeInTheDocument();

    await user.click(screen.getByTestId("radio-2"));
    expect(onValueChange).toHaveBeenCalledWith("option2");
  });

  test("renders dropdown menu with submenu", async () => {
    const user = userEvent.setup();

    render(
      <DropdownMenu>
        <DropdownMenuTrigger data-testid="main-trigger">Main Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger data-testid="sub-trigger">Submenu</DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent data-testid="sub-content">
                <DropdownMenuItem data-testid="sub-item">Submenu Item</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    const mainTrigger = screen.getByTestId("main-trigger");
    await user.click(mainTrigger);

    const subTrigger = screen.getByTestId("sub-trigger");
    expect(subTrigger).toBeInTheDocument();
  });

  test("renders dropdown menu with inset submenu trigger", async () => {
    const user = userEvent.setup();

    render(
      <DropdownMenu>
        <DropdownMenuTrigger data-testid="main-trigger">Main Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger inset data-testid="inset-sub-trigger">
              Inset Submenu
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Submenu Item</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    const mainTrigger = screen.getByTestId("main-trigger");
    await user.click(mainTrigger);

    const insetSubTrigger = screen.getByTestId("inset-sub-trigger");
    expect(insetSubTrigger).toBeInTheDocument();
  });

  test("renders dropdown menu item with icon", async () => {
    const user = userEvent.setup();
    const icon = <svg data-testid="menu-icon" />;

    render(
      <DropdownMenu>
        <DropdownMenuTrigger data-testid="trigger">Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem icon={icon} data-testid="item-with-icon">
            Item with Icon
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    const trigger = screen.getByTestId("trigger");
    await user.click(trigger);

    expect(screen.getByTestId("item-with-icon")).toBeInTheDocument();
    expect(screen.getByTestId("menu-icon")).toBeInTheDocument();
  });

  test("renders dropdown menu item with inset prop", async () => {
    const user = userEvent.setup();

    render(
      <DropdownMenu>
        <DropdownMenuTrigger data-testid="trigger">Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem inset data-testid="inset-item">
            Inset Item
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    const trigger = screen.getByTestId("trigger");
    await user.click(trigger);

    expect(screen.getByTestId("inset-item")).toBeInTheDocument();
  });
});
