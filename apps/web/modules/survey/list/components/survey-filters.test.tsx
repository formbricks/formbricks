import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurveyFilters } from "@formbricks/types/surveys/types";
import { SurveyFilters } from "./survey-filters";
import { initialFilters } from "./survey-list";

// Mock environment to prevent server-side env variable access
vi.mock("@/lib/env", () => ({
  env: {
    IS_FORMBRICKS_CLOUD: "0",
    NODE_ENV: "test",
  },
}));

// Mock constants that depend on env
vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: false,
  IS_PRODUCTION: false,
  GITHUB_ID: "mock-github-id",
  GITHUB_SECRET: "mock-github-secret",
  GOOGLE_CLIENT_ID: "mock-google-client-id",
  GOOGLE_CLIENT_SECRET: "mock-google-client-secret",
  AZUREAD_CLIENT_ID: "mock-azuread-client-id",
  AZUREAD_CLIENT_SECRET: "mock-azuread-client-secret",
  AZUREAD_TENANT_ID: "mock-azuread-tenant-id",
  OIDC_CLIENT_ID: "mock-oidc-client-id",
  OIDC_CLIENT_SECRET: "mock-oidc-client-secret",
  OIDC_ISSUER: "mock-oidc-issuer",
  OIDC_DISPLAY_NAME: "mock-oidc-display-name",
  OIDC_SIGNING_ALGORITHM: "mock-oidc-signing-algorithm",
  SMTP_FROM_ADDRESS: "mock-from-address",
  SMTP_HOST: "mock-smtp-host",
  SMTP_PORT: "mock-smtp-port",
  SMTP_SECURE_ENABLED: "mock-smtp-secure",
  WEBAPP_URL: "https://example.com",
  ENCRYPTION_KEY: "mock-encryption-key",
  ENTERPRISE_LICENSE_KEY: "mock-license-key",
  SESSION_MAX_AGE: 1000,
  AUDIT_LOG_ENABLED: 1,
  REDIS_URL: "redis://localhost:6379",
}));

// Track the callback for useDebounce to better control when it fires
let debouncedCallback: (() => void) | null = null;

// Mock dependencies
vi.mock("react-use", () => ({
  useDebounce: (callback: () => void, ms: number, deps: any[]) => {
    debouncedCallback = callback;
    return undefined;
  },
}));

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({ t: (key: string) => key }),
}));

// Mock the DropdownMenu components
vi.mock("@/modules/ui/components/dropdown-menu", () => ({
  DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuTrigger: ({ children, className }: any) => (
    <div data-testid="dropdown-menu-trigger" className={className}>
      {children}
    </div>
  ),
  DropdownMenuContent: ({ children, align, className }: any) => (
    <div data-testid="dropdown-menu-content" data-align={align} className={className}>
      {children}
    </div>
  ),
}));

// Mock the Button component
vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, onClick, className, size }: any) => (
    <button data-testid="clear-filters-button" className={className} onClick={onClick} data-size={size}>
      {children}
    </button>
  ),
}));

// Mock the SearchBar component
vi.mock("@/modules/ui/components/search-bar", () => ({
  SearchBar: ({ value, onChange, placeholder, className }: any) => (
    <input
      data-testid="search-bar"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
    />
  ),
}));

// Mock the SortOption component
vi.mock("./sort-option", () => ({
  SortOption: ({ option, sortBy, handleSortChange }: any) => (
    <div
      data-testid={`sort-option-${option.value}`}
      data-selected={option.value === sortBy}
      onClick={() => handleSortChange(option)}>
      {option.label}
    </div>
  ),
}));

// Mock the SurveyFilterDropdown component with direct call implementation
vi.mock("./survey-filter-dropdown", () => ({
  SurveyFilterDropdown: ({
    title,
    id,
    options,
    selectedOptions,
    setSelectedOptions,
    isOpen,
    toggleDropdown,
  }: any) => (
    <div
      data-testid={`filter-dropdown-${id}`}
      data-title={title}
      data-is-open={isOpen}
      onClick={() => toggleDropdown(id)}>
      <span>Filter: {title}</span>
      <ul>
        {options.map((option: any) => (
          <li
            key={option.value}
            data-testid={`filter-option-${id}-${option.value}`}
            data-selected={selectedOptions.includes(option.value)}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedOptions(option.value);
            }}>
            {option.label}
          </li>
        ))}
      </ul>
    </div>
  ),
}));

describe("SurveyFilters", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    debouncedCallback = null;
  });

  test("renders all filter components correctly", () => {
    const mockSetSurveyFilters = vi.fn();
    render(
      <SurveyFilters
        surveyFilters={{ ...initialFilters }}
        setSurveyFilters={mockSetSurveyFilters}
        currentProjectChannel="app"
      />
    );

    expect(screen.getByTestId("search-bar")).toBeInTheDocument();
    expect(screen.getByTestId("filter-dropdown-createdBy")).toBeInTheDocument();
    expect(screen.getByTestId("filter-dropdown-status")).toBeInTheDocument();
    expect(screen.getByTestId("filter-dropdown-type")).toBeInTheDocument();
    expect(screen.getByTestId("dropdown-menu")).toBeInTheDocument();
  });

  test("handles search input and debouncing", async () => {
    const mockSetSurveyFilters = vi.fn((x) => x({ ...initialFilters }));
    const user = userEvent.setup();

    render(
      <SurveyFilters
        surveyFilters={{ ...initialFilters }}
        setSurveyFilters={mockSetSurveyFilters}
        currentProjectChannel="app"
      />
    );

    const searchBar = screen.getByTestId("search-bar");
    await user.type(searchBar, "test");

    // Manually trigger the debounced callback
    if (debouncedCallback) {
      debouncedCallback();
    }

    // Check that setSurveyFilters was called with a function
    expect(mockSetSurveyFilters).toHaveBeenCalled();
  });

  test("handles toggling created by filter", async () => {
    const mockSetSurveyFilters = vi.fn((cb) => {
      const newFilters = cb({ ...initialFilters });
      return newFilters;
    });

    render(
      <SurveyFilters
        surveyFilters={{ ...initialFilters }}
        setSurveyFilters={mockSetSurveyFilters}
        currentProjectChannel="app"
      />
    );

    const createdByFilter = screen.getByTestId("filter-dropdown-createdBy");
    await userEvent.click(createdByFilter);

    const youOption = screen.getByTestId("filter-option-createdBy-you");
    await userEvent.click(youOption);

    expect(mockSetSurveyFilters).toHaveBeenCalled();
    // Check the result by calling the callback with initialFilters
    const result = mockSetSurveyFilters.mock.calls[0][0]({ ...initialFilters });
    expect(result.createdBy).toContain("you");
  });

  test("handles toggling status filter", async () => {
    const mockSetSurveyFilters = vi.fn((cb) => {
      const newFilters = cb({ ...initialFilters });
      return newFilters;
    });

    render(
      <SurveyFilters
        surveyFilters={{ ...initialFilters }}
        setSurveyFilters={mockSetSurveyFilters}
        currentProjectChannel="app"
      />
    );

    const statusFilter = screen.getByTestId("filter-dropdown-status");
    await userEvent.click(statusFilter);

    const draftOption = screen.getByTestId("filter-option-status-draft");
    await userEvent.click(draftOption);

    expect(mockSetSurveyFilters).toHaveBeenCalled();
    // Check the result by calling the callback with initialFilters
    const result = mockSetSurveyFilters.mock.calls[0][0]({ ...initialFilters });
    expect(result.status).toContain("draft");
  });

  test("handles toggling type filter", async () => {
    const mockSetSurveyFilters = vi.fn((cb) => {
      const newFilters = cb({ ...initialFilters });
      return newFilters;
    });

    render(
      <SurveyFilters
        surveyFilters={{ ...initialFilters }}
        setSurveyFilters={mockSetSurveyFilters}
        currentProjectChannel="app"
      />
    );

    const typeFilter = screen.getByTestId("filter-dropdown-type");
    await userEvent.click(typeFilter);

    const linkOption = screen.getByTestId("filter-option-type-link");
    await userEvent.click(linkOption);

    expect(mockSetSurveyFilters).toHaveBeenCalled();
    // Check the result by calling the callback with initialFilters
    const result = mockSetSurveyFilters.mock.calls[0][0]({ ...initialFilters });
    expect(result.type).toContain("link");
  });

  test("doesn't render type filter when currentProjectChannel is link", () => {
    const mockSetSurveyFilters = vi.fn();
    render(
      <SurveyFilters
        surveyFilters={{ ...initialFilters }}
        setSurveyFilters={mockSetSurveyFilters}
        currentProjectChannel="link"
      />
    );

    expect(screen.queryByTestId("filter-dropdown-type")).not.toBeInTheDocument();
  });

  test("shows clear filters button when filters are applied", () => {
    const mockSetSurveyFilters = vi.fn();
    const filtersWithValues: TSurveyFilters = {
      ...initialFilters,
      createdBy: ["you"],
      status: ["draft"],
      type: ["link"],
    };

    render(
      <SurveyFilters
        surveyFilters={filtersWithValues}
        setSurveyFilters={mockSetSurveyFilters}
        currentProjectChannel="app"
      />
    );

    const clearButton = screen.getByTestId("clear-filters-button");
    expect(clearButton).toBeInTheDocument();
  });

  test("doesn't show clear filters button when no filters are applied", () => {
    const mockSetSurveyFilters = vi.fn();
    render(
      <SurveyFilters
        surveyFilters={{ ...initialFilters }}
        setSurveyFilters={mockSetSurveyFilters}
        currentProjectChannel="app"
      />
    );

    expect(screen.queryByTestId("clear-filters-button")).not.toBeInTheDocument();
  });

  test("clears filters when clear button is clicked", async () => {
    const mockSetSurveyFilters = vi.fn();
    const mockLocalStorageRemove = vi.spyOn(Storage.prototype, "removeItem");
    const filtersWithValues: TSurveyFilters = {
      ...initialFilters,
      createdBy: ["you"],
      status: ["draft"],
      type: ["link"],
    };

    render(
      <SurveyFilters
        surveyFilters={filtersWithValues}
        setSurveyFilters={mockSetSurveyFilters}
        currentProjectChannel="app"
      />
    );

    const clearButton = screen.getByTestId("clear-filters-button");
    await userEvent.click(clearButton);

    expect(mockSetSurveyFilters).toHaveBeenCalledWith(initialFilters);
    expect(mockLocalStorageRemove).toHaveBeenCalledWith("surveyFilters");
  });

  test("changes sort option when a sort option is selected", async () => {
    const mockSetSurveyFilters = vi.fn((cb) => {
      const newFilters = cb({ ...initialFilters });
      return newFilters;
    });

    render(
      <SurveyFilters
        surveyFilters={{ ...initialFilters }}
        setSurveyFilters={mockSetSurveyFilters}
        currentProjectChannel="app"
      />
    );

    const updatedAtOption = screen.getByTestId("sort-option-updatedAt");
    await userEvent.click(updatedAtOption);

    expect(mockSetSurveyFilters).toHaveBeenCalled();
    // Check the result by calling the callback with initialFilters
    const result = mockSetSurveyFilters.mock.calls[0][0]({ ...initialFilters });
    expect(result.sortBy).toBe("updatedAt");
  });

  test("handles sortBy option that is not in the options list", () => {
    const mockSetSurveyFilters = vi.fn();
    const customFilters: TSurveyFilters = {
      ...initialFilters,
      sortBy: "nonExistentOption" as any,
    };

    render(
      <SurveyFilters
        surveyFilters={customFilters}
        setSurveyFilters={mockSetSurveyFilters}
        currentProjectChannel="app"
      />
    );

    expect(screen.getByTestId("dropdown-menu-trigger")).toBeInTheDocument();
  });
});
