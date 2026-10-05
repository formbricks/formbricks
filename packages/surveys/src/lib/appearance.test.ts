// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from "vitest";
import { disposeAppearance, getAppearance, initializeAppearance, setAppearance } from "./appearance";
import { addCustomThemeToDom } from "./styles";

vi.mock("./styles", () => ({ addCustomThemeToDom: vi.fn() }));

afterEach(() => {
  setAppearance("light");
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("renderer appearance", () => {
  test("defaults to light and switches tokens and portal roots without replacing answers or focus", () => {
    document.body.innerHTML = '<div id="fbjs"><input value="my answer"></div><div id="fbjs"></div>';
    const input = document.querySelector("input")!;
    input.focus();
    initializeAppearance({});
    expect(getAppearance()).toBe("light");
    setAppearance("dark");
    expect(addCustomThemeToDom).toHaveBeenLastCalledWith({ styling: {}, appearance: "dark" });
    expect(
      [...document.querySelectorAll("#fbjs")].map((root) => root.getAttribute("data-appearance"))
    ).toEqual(["dark", "dark"]);
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe("my answer");
  });

  test("follows system only while opted in, removing the previous listener on explicit selection", () => {
    const query = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => query)
    );
    initializeAppearance({}, "system");
    expect(getAppearance()).toBe("dark");
    const listener = query.addEventListener.mock.calls[0][1] as () => void;
    query.matches = false;
    listener();
    expect(getAppearance()).toBe("light");
    setAppearance("dark");
    expect(query.removeEventListener).toHaveBeenCalledWith("change", listener);
    expect(getAppearance()).toBe("dark");
    initializeAppearance({}, "system");
    disposeAppearance();
    expect(query.removeEventListener).toHaveBeenCalledTimes(2);
  });
});
