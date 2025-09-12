import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ResponseCardQuotas } from "./single-response-card-quotas";

vi.mock("@/modules/ui/components/response-badges", () => ({
  ResponseBadges: ({ items, showId }: { items: { value: string }[]; showId: boolean }) => (
    <div data-testid="response-badges">{items.map((item) => item.value).join(", ")}</div>
  ),
}));

describe("ResponseCardQuotas", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders response card quotas", () => {
    render(<ResponseCardQuotas quotas={[{ id: "quota1", name: "Quota 1" }]} />);

    expect(screen.getByText("Quota 1")).toBeInTheDocument();
    expect(screen.getByTestId("response-badges")).toBeInTheDocument();
  });

  test("renders no response card quotas", () => {
    render(<ResponseCardQuotas quotas={[]} />);

    expect(screen.queryByTestId("response-badges")).not.toBeInTheDocument();
    expect(screen.queryByTestId("main-quotas-div")).toBeNull();
  });
});
