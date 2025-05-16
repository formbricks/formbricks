import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import AttributeTabContent from "./attribute-tab-content";

describe("AttributeTabContent", () => {
  afterEach(() => {
    cleanup();
  });

  const mockContactAttributeKeys: TContactAttributeKey[] = [
    { id: "attr1", key: "email", name: "Email Address", environmentId: "env1" } as TContactAttributeKey,
    { id: "attr2", key: "plan", name: "Plan Type", environmentId: "env1" } as TContactAttributeKey,
  ];

  test("renders person and attribute buttons", () => {
    render(
      <AttributeTabContent
        contactAttributeKeys={mockContactAttributeKeys}
        onAddFilter={vi.fn()}
        setOpen={vi.fn()}
        handleAddFilter={vi.fn()}
      />
    );
    expect(screen.getByTestId("filter-btn-person-userId")).toBeInTheDocument();
    expect(screen.getByTestId("filter-btn-attribute-email")).toBeInTheDocument();
    expect(screen.getByTestId("filter-btn-attribute-plan")).toBeInTheDocument();
  });

  test("shows empty state when no attributes", () => {
    render(
      <AttributeTabContent
        contactAttributeKeys={[]}
        onAddFilter={vi.fn()}
        setOpen={vi.fn()}
        handleAddFilter={vi.fn()}
      />
    );
    expect(screen.getByText(/no_attributes_yet/i)).toBeInTheDocument();
  });

  test("calls handleAddFilter with correct args for person", async () => {
    const handleAddFilter = vi.fn();
    render(
      <AttributeTabContent
        contactAttributeKeys={mockContactAttributeKeys}
        onAddFilter={vi.fn()}
        setOpen={vi.fn()}
        handleAddFilter={handleAddFilter}
      />
    );
    await userEvent.click(screen.getByTestId("filter-btn-person-userId"));
    expect(handleAddFilter).toHaveBeenCalledWith(expect.objectContaining({ type: "person" }));
  });

  test("calls handleAddFilter with correct args for attribute", async () => {
    const handleAddFilter = vi.fn();
    render(
      <AttributeTabContent
        contactAttributeKeys={mockContactAttributeKeys}
        onAddFilter={vi.fn()}
        setOpen={vi.fn()}
        handleAddFilter={handleAddFilter}
      />
    );
    await userEvent.click(screen.getByTestId("filter-btn-attribute-email"));
    expect(handleAddFilter).toHaveBeenCalledWith(
      expect.objectContaining({ type: "attribute", contactAttributeKey: "email" })
    );
  });
});
