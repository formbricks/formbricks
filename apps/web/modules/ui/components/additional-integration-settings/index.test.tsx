import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AdditionalIntegrationSettings } from "./index";

describe("AdditionalIntegrationSettings", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders all checkboxes correctly", () => {
    const mockProps = {
      includeVariables: false,
      includeHiddenFields: false,
      includeMetadata: false,
      includeCreatedAt: false,
      setIncludeVariables: vi.fn(),
      setIncludeHiddenFields: vi.fn(),
      setIncludeMetadata: vi.fn(),
      setIncludeCreatedAt: vi.fn(),
    };

    render(<AdditionalIntegrationSettings {...mockProps} />);

    expect(screen.getByText("environments.integrations.additional_settings")).toBeInTheDocument();
    expect(screen.getByText("environments.integrations.include_created_at")).toBeInTheDocument();
    expect(screen.getByText("environments.integrations.include_variables")).toBeInTheDocument();
    expect(screen.getByText("environments.integrations.include_hidden_fields")).toBeInTheDocument();
    expect(screen.getByText("environments.integrations.include_metadata")).toBeInTheDocument();
  });

  test("checkboxes have correct initial state", () => {
    const mockProps = {
      includeVariables: true,
      includeHiddenFields: false,
      includeMetadata: true,
      includeCreatedAt: false,
      setIncludeVariables: vi.fn(),
      setIncludeHiddenFields: vi.fn(),
      setIncludeMetadata: vi.fn(),
      setIncludeCreatedAt: vi.fn(),
    };

    render(<AdditionalIntegrationSettings {...mockProps} />);

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(4);

    // Check that the checkboxes have correct initial checked state
    expect(checkboxes[0]).not.toBeChecked(); // includeCreatedAt
    expect(checkboxes[1]).toBeChecked(); // includeVariables
    expect(checkboxes[2]).not.toBeChecked(); // includeHiddenFields
    expect(checkboxes[3]).toBeChecked(); // includeMetadata
  });

  test("calls the appropriate setter function when checkbox is clicked", async () => {
    const mockProps = {
      includeVariables: false,
      includeHiddenFields: false,
      includeMetadata: false,
      includeCreatedAt: false,
      setIncludeVariables: vi.fn(),
      setIncludeHiddenFields: vi.fn(),
      setIncludeMetadata: vi.fn(),
      setIncludeCreatedAt: vi.fn(),
    };

    render(<AdditionalIntegrationSettings {...mockProps} />);

    const user = userEvent.setup();

    // Click on each checkbox and verify the setter is called with correct value
    const checkboxes = screen.getAllByRole("checkbox");

    await user.click(checkboxes[0]); // includeCreatedAt
    expect(mockProps.setIncludeCreatedAt).toHaveBeenCalledWith(true);

    await user.click(checkboxes[1]); // includeVariables
    expect(mockProps.setIncludeVariables).toHaveBeenCalledWith(true);

    await user.click(checkboxes[2]); // includeHiddenFields
    expect(mockProps.setIncludeHiddenFields).toHaveBeenCalledWith(true);

    await user.click(checkboxes[3]); // includeMetadata
    expect(mockProps.setIncludeMetadata).toHaveBeenCalledWith(true);
  });

  test("toggling checkboxes switches boolean values correctly", async () => {
    const mockProps = {
      includeVariables: true,
      includeHiddenFields: false,
      includeMetadata: true,
      includeCreatedAt: false,
      setIncludeVariables: vi.fn(),
      setIncludeHiddenFields: vi.fn(),
      setIncludeMetadata: vi.fn(),
      setIncludeCreatedAt: vi.fn(),
    };

    render(<AdditionalIntegrationSettings {...mockProps} />);

    const user = userEvent.setup();
    const checkboxes = screen.getAllByRole("checkbox");

    await user.click(checkboxes[1]); // includeVariables (true -> false)
    expect(mockProps.setIncludeVariables).toHaveBeenCalledWith(false);

    await user.click(checkboxes[2]); // includeHiddenFields (false -> true)
    expect(mockProps.setIncludeHiddenFields).toHaveBeenCalledWith(true);
  });
});
