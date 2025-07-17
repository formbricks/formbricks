import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Home, Settings, User } from "lucide-react";
import { afterEach, describe, expect, test } from "vitest";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./index";

describe("Tabs", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders tabs with default variant and size", () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    );

    expect(screen.getByText("Tab 1")).toBeInTheDocument();
    expect(screen.getByText("Tab 2")).toBeInTheDocument();
    expect(screen.getByText("Content 1")).toBeInTheDocument();
    expect(screen.queryByText("Content 2")).not.toBeInTheDocument();
  });

  test("switches tabs when clicked", async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    );

    await user.click(screen.getByText("Tab 2"));

    expect(screen.getByText("Content 2")).toBeInTheDocument();
    expect(screen.queryByText("Content 1")).not.toBeInTheDocument();
  });

  test("renders with disabled variant", () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList variant="disabled">
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
      </Tabs>
    );

    const tabsList = screen.getByRole("tablist");
    expect(tabsList).toHaveClass("opacity-50");
    expect(tabsList).toHaveClass("pointer-events-none");
  });

  test("renders with big size", () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList size="big">
          <TabsTrigger value="tab1" size="big">
            Tab 1
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
      </Tabs>
    );

    const tabsList = screen.getByRole("tablist");
    expect(tabsList).toHaveClass("h-auto");

    const trigger = screen.getByRole("tab");
    expect(trigger).toHaveClass("px-3");
    expect(trigger).toHaveClass("py-2");
  });

  test("renders triggers with icons", () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1" icon={<Home data-testid="home-icon" />}>
            Home
          </TabsTrigger>
          <TabsTrigger value="tab2" icon={<User data-testid="user-icon" />}>
            Profile
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Home Content</TabsContent>
        <TabsContent value="tab2">Profile Content</TabsContent>
      </Tabs>
    );

    expect(screen.getByTestId("home-icon")).toBeInTheDocument();
    expect(screen.getByTestId("user-icon")).toBeInTheDocument();
  });

  test("hides icons when showIcon is false", () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1" icon={<Home data-testid="home-icon" />} showIcon={false}>
            Home
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Home Content</TabsContent>
      </Tabs>
    );

    expect(screen.queryByTestId("home-icon")).not.toBeInTheDocument();
    expect(screen.getByText("Home")).toBeInTheDocument();
  });

  test("shows icons when showIcon is true", () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1" icon={<Home data-testid="home-icon" />} showIcon={true}>
            Home
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Home Content</TabsContent>
      </Tabs>
    );

    expect(screen.getByTestId("home-icon")).toBeInTheDocument();
  });

  test("renders with column layout", () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1" layout="column">
            Tab 1
          </TabsTrigger>
          <TabsTrigger value="tab2" layout="column">
            Tab 2
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
      </Tabs>
    );

    const triggers = screen.getAllByRole("tab");
    triggers.forEach((trigger) => {
      expect(trigger).toHaveClass("flex-col");
      expect(trigger).toHaveClass("gap-1");
    });
  });

  test("renders with row layout", () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1" layout="row">
            Tab 1
          </TabsTrigger>
          <TabsTrigger value="tab2" layout="row">
            Tab 2
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
      </Tabs>
    );

    const triggers = screen.getAllByRole("tab");
    triggers.forEach((trigger) => {
      expect(trigger).toHaveClass("flex-row");
      expect(trigger).toHaveClass("gap-2");
    });
  });

  test("applies custom className to Tabs component", () => {
    const { container } = render(
      <Tabs defaultValue="tab1" className="custom-tabs-class">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
      </Tabs>
    );

    const tabsContainer = container.firstChild as HTMLElement;
    expect(tabsContainer).toHaveClass("custom-tabs-class");
  });

  test("applies custom className to TabsList", () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList className="custom-list-class">
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
      </Tabs>
    );

    const tabsList = screen.getByRole("tablist");
    expect(tabsList).toHaveClass("custom-list-class");
  });

  test("applies custom className to TabsTrigger", () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1" className="custom-trigger-class">
            Tab 1
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
      </Tabs>
    );

    const trigger = screen.getByRole("tab");
    expect(trigger).toHaveClass("custom-trigger-class");
  });

  test("applies custom className to TabsContent", () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1" className="custom-content-class">
          Content 1
        </TabsContent>
      </Tabs>
    );

    const content = screen.getByText("Content 1");
    expect(content).toHaveClass("custom-content-class");
  });

  test("renders with disabled trigger variant", () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1" variant="disabled">
            Tab 1
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
      </Tabs>
    );

    const trigger = screen.getByRole("tab");
    expect(trigger).toHaveClass("opacity-50");
    expect(trigger).toHaveClass("pointer-events-none");
  });

  test("handles keyboard navigation", async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          <TabsTrigger value="tab3">Tab 3</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
        <TabsContent value="tab3">Content 3</TabsContent>
      </Tabs>
    );

    const allTabs = screen.getAllByRole("tab");
    const firstTab = allTabs[0];
    const secondTab = allTabs[1];

    await user.tab();
    expect(firstTab).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(secondTab).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(firstTab).toHaveFocus();
  });

  test("renders with big size trigger and correct icon sizing", () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList size="big">
          <TabsTrigger value="tab1" size="big" icon={<Settings data-testid="settings-icon" />}>
            Settings
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Settings Content</TabsContent>
      </Tabs>
    );

    const trigger = screen.getByRole("tab");
    expect(trigger).toHaveClass("[&_svg]:size-8");
    expect(trigger).toHaveClass("[&_svg]:stroke-[1.5]");
  });

  test("renders with default size trigger and correct icon sizing", () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1" icon={<Settings data-testid="settings-icon" />}>
            Settings
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Settings Content</TabsContent>
      </Tabs>
    );

    const trigger = screen.getByRole("tab");
    expect(trigger).toHaveClass("[&_svg]:size-4");
    expect(trigger).toHaveClass("[&_svg]:stroke-2");
  });

  test("passes through additional props to components", () => {
    render(
      <Tabs defaultValue="tab1" data-testid="tabs-root">
        <TabsList data-testid="tabs-list">
          <TabsTrigger value="tab1" data-testid="tabs-trigger">
            Tab 1
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tab1" data-testid="tabs-content">
          Content 1
        </TabsContent>
      </Tabs>
    );

    expect(screen.getByTestId("tabs-root")).toBeInTheDocument();
    expect(screen.getByTestId("tabs-list")).toBeInTheDocument();
    expect(screen.getByTestId("tabs-trigger")).toBeInTheDocument();
    expect(screen.getByTestId("tabs-content")).toBeInTheDocument();
  });

  test("renders with active state styling", () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    );

    const allTabs = screen.getAllByRole("tab");
    const activeTab = allTabs[0];
    const inactiveTab = allTabs[1];

    expect(activeTab).toHaveClass("data-[state=active]:bg-white");
    expect(activeTab).toHaveClass("data-[state=active]:text-slate-900");
    expect(activeTab).toHaveClass("data-[state=active]:shadow-sm");

    expect(inactiveTab).toHaveClass("data-[state=inactive]:text-slate-600");
  });

  test("renders multiple tabs with complex layout", () => {
    render(
      <Tabs defaultValue="home">
        <TabsList>
          <TabsTrigger value="home" icon={<Home />} layout="column" size="big">
            Home
          </TabsTrigger>
          <TabsTrigger value="profile" icon={<User />} layout="column" size="big">
            Profile
          </TabsTrigger>
          <TabsTrigger value="settings" icon={<Settings />} layout="column" size="big">
            Settings
          </TabsTrigger>
        </TabsList>
        <TabsContent value="home">Home Content</TabsContent>
        <TabsContent value="profile">Profile Content</TabsContent>
        <TabsContent value="settings">Settings Content</TabsContent>
      </Tabs>
    );

    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Profile")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Home Content")).toBeInTheDocument();
  });
});
