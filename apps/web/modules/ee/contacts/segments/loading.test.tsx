import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import Loading from "./loading";

// Mock the getTranslate function
vi.mock("@/tolgee/server", () => ({
  getTranslate: async () => (key: string) => key,
}));

// Mock the ContactsSecondaryNavigation component
vi.mock("@/modules/ee/contacts/components/contacts-secondary-navigation", () => ({
  ContactsSecondaryNavigation: () => <div>ContactsSecondaryNavigation</div>,
}));

describe("Loading", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders loading state correctly", async () => {
    render(await Loading());

    // Check for the presence of the secondary navigation mock
    expect(screen.getByText("ContactsSecondaryNavigation")).toBeInTheDocument();

    // Check for table headers based on tolgee keys
    expect(screen.getByText("common.title")).toBeInTheDocument();
    expect(screen.getByText("common.surveys")).toBeInTheDocument();
    expect(screen.getByText("common.updated_at")).toBeInTheDocument();
    expect(screen.getByText("common.created_at")).toBeInTheDocument();

    // Check for the presence of multiple skeleton loaders (at least one)
    const skeletonLoaders = screen.getAllByRole("generic", { name: "" }); // Assuming skeleton divs don't have specific roles/names
    // Filter for elements with animate-pulse class
    const pulseElements = skeletonLoaders.filter((el) => el.classList.contains("animate-pulse"));
    expect(pulseElements.length).toBeGreaterThan(0);
  });
});
