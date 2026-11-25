import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ContactControlBar } from "./contact-control-bar";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) => (values ? `${key} ${JSON.stringify(values)}` : key),
  }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/modules/ee/contacts/lib/api-client", () => ({ deleteContact: vi.fn() }));
// The bar's other modals are not what this file proves.
vi.mock("@/modules/ee/contacts/components/edit-contact-attributes-modal", () => ({
  EditContactAttributesModal: () => null,
}));
vi.mock("./generate-personal-link-modal", () => ({ GeneratePersonalLinkModal: () => null }));

const SHARED_NOTE = 'workspace.contacts.delete_contact_shared_directory_note {"directoryName":"Main"}';

const renderBar = (sharedDirectoryName: string | null) => {
  render(
    <ContactControlBar
      contactId="clcontact0000000000000001"
      workspaceId="clworkspace00000000000001"
      isReadOnly={false}
      isQuotasAllowed={false}
      sharedDirectoryName={sharedDirectoryName}
      publishedLinkSurveys={[]}
      allAttributeKeys={[]}
      currentAttributes={[]}
    />
  );
  return screen.getByRole("button", { name: "common.delete" });
};

describe("ContactControlBar Delete", () => {
  afterEach(cleanup);

  // A contact in a directory other workspaces use can't be deleted: the trash icon says so up front
  // instead of opening a dialog that can only fail.
  test("shows as disabled for a shared directory, opens nothing, and says why on focus", async () => {
    const deleteButton = renderBar("Main");

    expect(deleteButton.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(deleteButton);
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.focus(deleteButton);
    expect((await screen.findAllByText(SHARED_NOTE)).length).toBeGreaterThan(0);
  });

  test("opens the confirmation when the directory isn't shared", () => {
    const deleteButton = renderBar(null);

    expect(deleteButton.getAttribute("aria-disabled")).toBeNull();
    fireEvent.click(deleteButton);
    expect(screen.getByText("workspace.contacts.delete_contact_confirmation")).toBeTruthy();
  });
});
