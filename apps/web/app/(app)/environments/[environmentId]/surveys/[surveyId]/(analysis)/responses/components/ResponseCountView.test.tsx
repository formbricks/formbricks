import { ResponseCountView } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponseCountView";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, test, vi } from "vitest";

const defaultProps = {
  totalCount: 70,
  paginatedCount: 25,
  filteredCount: 30,
};

vi.mock("@/app/(app)/environments/[environmentId]/components/ResponseFilterContext", () => ({
  useResponseFilter: () => ({ resetState: vi.fn() }),
}));

describe("ResponseCountView", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders ResponseCountView with correct props", () => {
    render(<ResponseCountView {...defaultProps} />);
  });
});
