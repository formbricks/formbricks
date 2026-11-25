import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import toast from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import type { TContactDirectoryMatchingKey } from "@/modules/ee/contacts/directories/types";
import { UploadContactsCSVButton } from "./upload-contacts-button";

const mocks = vi.hoisted(() => ({ importContacts: vi.fn() }));

// A stable `t`, as the real hook gives: the component re-validates when `t` changes identity.
vi.mock("react-i18next", () => {
  const t = (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${JSON.stringify(values)}` : key;
  return { useTranslation: () => ({ t }) };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/modules/ee/contacts/lib/api-client", () => ({ importContacts: mocks.importContacts }));
vi.mock("react-hot-toast", () => {
  const toastFn = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() });
  return { default: toastFn };
});

const attributeKey = (key: string): TContactAttributeKey =>
  ({ id: `key-${key}`, key, name: key, dataType: "string" }) as TContactAttributeKey;

const renderButton = (matchingKey: TContactDirectoryMatchingKey) => {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <UploadContactsCSVButton
        workspaceId="workspace-1"
        contactAttributeKeys={[attributeKey("email"), attributeKey("externalId")]}
        matchingKey={matchingKey}
      />
    </QueryClientProvider>
  );
  fireEvent.click(screen.getByRole("button", { name: /common.upload CSV/ }));
};

const pickCsv = (content: string) => {
  const input = document.querySelector<HTMLInputElement>("input#file");
  if (!input) throw new Error("file input not rendered");
  fireEvent.change(input, { target: { files: [new File([content], "contacts.csv", { type: "text/csv" })] } });
};

describe("UploadContactsCSVButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const upload = async () => {
    await screen.findByText("workspace.contacts.upload_contacts_modal_preview");
    fireEvent.click(
      screen.getByRole("button", { name: "workspace.contacts.upload_contacts_modal_upload_btn" })
    );
  };

  test("an external-ID directory asks for an externalId column", async () => {
    renderButton("externalId");

    pickCsv("email\na@example.com");
    await upload();

    expect(await screen.findByText("Missing externalId field for one or more records")).toBeInTheDocument();
    expect(mocks.importContacts).not.toHaveBeenCalled();
  });

  // The matching column is read through the column mapping, as userId and every other key are: a CRM's
  // "External ID" header maps to the externalId key, and is checked there.
  test("accepts a matching column whose header maps to the key, like External ID", async () => {
    mocks.importContacts.mockResolvedValue({
      contacts: [],
      multiMatchCount: 0,
      leftOutCounts: { email: 0, userId: 0 },
    });
    renderButton("externalId");

    pickCsv("External ID,email\nCRM-1,a@example.com\nCRM-2,b@example.com");
    await upload();

    await waitFor(() => expect(mocks.importContacts).toHaveBeenCalled());
    expect(mocks.importContacts.mock.calls[0][1].csvData).toEqual([
      { externalId: "CRM-1", email: "a@example.com" },
      { externalId: "CRM-2", email: "b@example.com" },
    ]);
  });

  test("refuses a repeated matching value under a mapped header, before uploading", async () => {
    renderButton("externalId");

    pickCsv("external_id,email\nCRM-1,a@example.com\nCRM-1,b@example.com");
    await upload();

    expect(await screen.findByText("Duplicate externalIds found in the records")).toBeInTheDocument();
    expect(mocks.importContacts).not.toHaveBeenCalled();
  });

  test("accepts an email column headed E-mail in an email directory", async () => {
    mocks.importContacts.mockResolvedValue({
      contacts: [],
      multiMatchCount: 0,
      leftOutCounts: { email: 0, userId: 0 },
    });
    renderButton("email");

    pickCsv("E-mail\na@example.com");
    await upload();

    await waitFor(() => expect(mocks.importContacts).toHaveBeenCalled());
    expect(mocks.importContacts.mock.calls[0][1].csvData).toEqual([{ email: "a@example.com" }]);
  });

  test("reports rows that matched several contacts after the upload", async () => {
    mocks.importContacts.mockResolvedValue({
      contacts: [],
      multiMatchCount: 2,
      leftOutCounts: { email: 0, userId: 0 },
    });
    renderButton("email");

    pickCsv("email\na@example.com");
    await screen.findByText("workspace.contacts.upload_contacts_modal_preview");
    fireEvent.click(
      screen.getByRole("button", { name: "workspace.contacts.upload_contacts_modal_upload_btn" })
    );

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith('workspace.contacts.upload_contacts_multi_match {"count":2}')
    );
    expect(toast.success).toHaveBeenCalledWith("workspace.contacts.upload_contacts_success");
  });

  test("shows no multi-match note when every row matched at most one contact", async () => {
    mocks.importContacts.mockResolvedValue({
      contacts: [],
      multiMatchCount: 0,
      leftOutCounts: { email: 0, userId: 0 },
    });
    renderButton("email");

    pickCsv("email\na@example.com");
    await screen.findByText("workspace.contacts.upload_contacts_modal_preview");
    fireEvent.click(
      screen.getByRole("button", { name: "workspace.contacts.upload_contacts_modal_upload_btn" })
    );

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(toast).not.toHaveBeenCalled();
  });

  test("says how many rows were imported without an email or userId another contact holds", async () => {
    mocks.importContacts.mockResolvedValue({
      contacts: [],
      multiMatchCount: 0,
      leftOutCounts: { email: 2, userId: 1 },
    });
    renderButton("externalId");

    pickCsv("externalId,email\nCRM-1,a@example.com");
    await upload();

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith('workspace.contacts.upload_contacts_emails_left_out {"count":2}')
    );
    expect(toast).toHaveBeenCalledWith('workspace.contacts.upload_contacts_user_ids_left_out {"count":1}');
  });
});
