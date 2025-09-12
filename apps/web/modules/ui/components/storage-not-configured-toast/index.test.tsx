import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { StorageNotConfiguredToast } from "./index";

describe("StorageNotConfiguredToast", () => {
  test("renders the message and a learn more link with correct attributes", () => {
    render(<StorageNotConfiguredToast />);

    expect(screen.getByText("File storage not set up")).toBeInTheDocument();

    const link = screen.getByRole("link", { name: "Learn more" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute(
      "href",
      "https://formbricks.com/docs/self-hosting/configuration/file-uploads"
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
