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
// The bar's other modals and icon tooltips are not what this file proves.
vi.mock("@/modules/ee/contacts/components/edit-contact-attributes-modal", () => ({
  EditContactAttributesModal: () => null,
}));
vi.mock("./generate-personal-link-modal", () => ({ GeneratePersonalLinkModal: () => null }));
vi.mock("@/modules/ui/components/iconbar", () => ({
  IconBar: ({ actions }: Readonly<{ actions: { tooltip: string; onClick: () => void }[] }>) => (
    <div>
      {actions.map((action) => (
        <button key={action.tooltip} type="button" onClick={action.onClick}>
          {action.tooltip}
        </button>
      ))}
    </div>
  ),
}));

const openDeleteDialog = (sharedDirectoryName: string | null) => {
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
  fireEvent.click(screen.getByRole("button", { name: "common.delete" }));
  return screen.getAllByRole("button", { name: "common.delete" }).at(-1) as HTMLButtonElement;
};

describe("ContactControlBar delete dialog", () => {
  afterEach(cleanup);

  // A contact in a directory other workspaces use can't be deleted: the dialog says so up front
  // instead of failing on Delete with an error toast.
  test("says a contact of a shared directory can't be deleted, with Delete disabled", () => {
    const dialogDelete = openDeleteDialog("Main");

    expect(
      screen.getByText('workspace.contacts.delete_contact_shared_directory_note {"directoryName":"Main"}')
    ).toBeTruthy();
    expect(dialogDelete.disabled).toBe(true);
  });

  test("asks for confirmation, with Delete enabled, when the directory isn't shared", () => {
    const dialogDelete = openDeleteDialog(null);

    expect(screen.getByText("workspace.contacts.delete_contact_confirmation")).toBeTruthy();
    expect(dialogDelete.disabled).toBe(false);
  });
});
