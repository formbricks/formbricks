import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { LoadingSkeleton } from "./loading-skeleton";

describe("LoadingSkeleton", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders all skeleton elements correctly for the loading state", () => {
    render(<LoadingSkeleton />);
    const skeletonElements = screen.getAllByRole("generic");
    const pulseElements = skeletonElements.filter((el) => el.classList.contains("animate-pulse"));

    expect(pulseElements.length).toBe(9);
  });

  test("applies the animate-pulse class to skeleton elements", () => {
    render(<LoadingSkeleton />);
    const animatedElements = document.querySelectorAll(".animate-pulse");

    expect(animatedElements.length).toBeGreaterThan(0);
    animatedElements.forEach((element: Element) => {
      expect(element.classList.contains("animate-pulse")).toBe(true);
    });
  });
});
