import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { Header } from "./index";

describe("Header", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the title correctly", () => {
    render(<Header title="Test Title" />);
    expect(screen.getByText("Test Title")).toBeInTheDocument();
  });

  test("renders the subtitle when provided", () => {
    render(<Header title="Test Title" subtitle="Test Subtitle" />);
    expect(screen.getByText("Test Title")).toBeInTheDocument();
    expect(screen.getByText("Test Subtitle")).toBeInTheDocument();
  });

  test("does not render subtitle when not provided", () => {
    render(<Header title="Test Title" />);
    expect(screen.getByText("Test Title")).toBeInTheDocument();
    expect(screen.queryByText("Test Subtitle")).not.toBeInTheDocument();
  });
});
