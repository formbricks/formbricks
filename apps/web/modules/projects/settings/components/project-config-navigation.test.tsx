import { SecondaryNavigation } from "@/modules/ui/components/secondary-navigation";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ProjectConfigNavigation } from "./project-config-navigation";

vi.mock("@/modules/ui/components/secondary-navigation", () => ({
  SecondaryNavigation: vi.fn(() => <div data-testid="secondary-navigation" />),
}));

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({ t: (key: string) => key }),
}));

let mockPathname = "/environments/env-1/project/look";
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => mockPathname),
}));

describe("ProjectConfigNavigation", () => {
  afterEach(() => {
    cleanup();
  });

  test("sets current to true for the correct nav item based on pathname", () => {
    const cases = [
      { path: "/environments/env-1/project/general", idx: 0 },
      { path: "/environments/env-1/project/look", idx: 1 },
      { path: "/environments/env-1/project/languages", idx: 2 },
      { path: "/environments/env-1/project/tags", idx: 3 },
      { path: "/environments/env-1/project/app-connection", idx: 4 },
      { path: "/environments/env-1/project/teams", idx: 5 },
    ];
    for (const { path, idx } of cases) {
      mockPathname = path;
      render(<ProjectConfigNavigation activeId="irrelevant" environmentId="env-1" />);
      const navArg = SecondaryNavigation.mock.calls[0][0].navigation;

      navArg.forEach((item: any, i: number) => {
        if (i === idx) {
          expect(item.current).toBe(true);
        } else {
          expect(item.current).toBe(false);
        }
      });
      SecondaryNavigation.mockClear();
    }
  });
});
