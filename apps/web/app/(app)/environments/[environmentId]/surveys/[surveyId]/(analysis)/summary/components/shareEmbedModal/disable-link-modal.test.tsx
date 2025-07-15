import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DisableLinkModal } from "./disable-link-modal";

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

const onOpenChange = vi.fn();
const onDisable = vi.fn();

describe("DisableLinkModal", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("should render the modal for multi-use link", () => {
    render(
      <DisableLinkModal open={true} onOpenChange={onOpenChange} type="multi-use" onDisable={onDisable} />
    );

    expect(
      screen.getByText("environments.surveys.share.anonymous_links.disable_multi_use_link_modal_title")
    ).toBeInTheDocument();
    expect(
      screen.getByText("environments.surveys.share.anonymous_links.disable_multi_use_link_modal_description")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "environments.surveys.share.anonymous_links.disable_multi_use_link_modal_description_subtext"
      )
    ).toBeInTheDocument();
  });

  test("should render the modal for single-use link", () => {
    render(
      <DisableLinkModal open={true} onOpenChange={onOpenChange} type="single-use" onDisable={onDisable} />
    );

    expect(screen.getByText("common.are_you_sure")).toBeInTheDocument();
    expect(
      screen.getByText("environments.surveys.share.anonymous_links.disable_single_use_link_modal_description")
    ).toBeInTheDocument();
  });

  test("should call onDisable and onOpenChange when the disable button is clicked for multi-use", async () => {
    render(
      <DisableLinkModal open={true} onOpenChange={onOpenChange} type="multi-use" onDisable={onDisable} />
    );

    const disableButton = screen.getByText(
      "environments.surveys.share.anonymous_links.disable_multi_use_link_modal_button"
    );
    await userEvent.click(disableButton);

    expect(onDisable).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test("should call onDisable and onOpenChange when the disable button is clicked for single-use", async () => {
    render(
      <DisableLinkModal open={true} onOpenChange={onOpenChange} type="single-use" onDisable={onDisable} />
    );

    const disableButton = screen.getByText(
      "environments.surveys.share.anonymous_links.disable_single_use_link_modal_button"
    );
    await userEvent.click(disableButton);

    expect(onDisable).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test("should call onOpenChange when the cancel button is clicked", async () => {
    render(
      <DisableLinkModal open={true} onOpenChange={onOpenChange} type="multi-use" onDisable={onDisable} />
    );

    const cancelButton = screen.getByText("common.cancel");
    await userEvent.click(cancelButton);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test("should not render the modal when open is false", () => {
    const { container } = render(
      <DisableLinkModal open={false} onOpenChange={onOpenChange} type="multi-use" onDisable={onDisable} />
    );
    expect(container.firstChild).toBeNull();
  });
});
