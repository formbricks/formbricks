import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import SegmentsPageWrapper from "./page";

vi.mock("@/modules/ee/contacts/segments/page", () => ({
  SegmentsPage: vi.fn(() => <div>SegmentsPageMock</div>),
}));

describe("SegmentsPageWrapper", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the SegmentsPage component", () => {
    render(<SegmentsPageWrapper params={{ environmentId: "test-env" } as any} />);
    expect(screen.getByText("SegmentsPageMock")).toBeInTheDocument();
  });
});
