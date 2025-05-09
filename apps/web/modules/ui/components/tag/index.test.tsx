import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { Tag } from "./index";

describe("Tag", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders tag with correct name", () => {
    render(<Tag tagId="tag1" tagName="Test Tag" onDelete={() => {}} />);

    expect(screen.getByText("Test Tag")).toBeInTheDocument();
  });

  test("applies highlight class when highlight prop is true", () => {
    const { container } = render(
      <Tag tagId="tag1" tagName="Test Tag" onDelete={() => {}} highlight={true} />
    );

    const tagElement = container.firstChild as HTMLElement;
    expect(tagElement).toHaveClass("animate-shake");
  });

  test("does not apply highlight class when highlight prop is false", () => {
    const { container } = render(
      <Tag tagId="tag1" tagName="Test Tag" onDelete={() => {}} highlight={false} />
    );

    const tagElement = container.firstChild as HTMLElement;
    expect(tagElement).not.toHaveClass("animate-shake");
  });

  test("does not render delete icon when allowDelete is false", () => {
    render(<Tag tagId="tag1" tagName="Test Tag" onDelete={() => {}} allowDelete={false} />);

    expect(screen.queryByRole("img", { hidden: true })).not.toBeInTheDocument();
  });
});
