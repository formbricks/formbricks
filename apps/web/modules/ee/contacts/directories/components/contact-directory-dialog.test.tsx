import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import toast from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { TContactDirectory, TContactDirectoryList } from "../types";
import { ContactDirectoryDialog } from "./contact-directory-dialog";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) => (values ? `${key} ${JSON.stringify(values)}` : key),
  }),
}));

const ORG_ID = "clorg11111111111111111111";
const LIST_URL = `/api/internal/contact-directories?organizationId=${ORG_ID}`;
const K = "workspace.settings.contact_directories";

const directory = (id: string, extra: Partial<TContactDirectory>): TContactDirectory => ({
  id,
  name: id,
  matchingKey: "email",
  workspaces: [],
  contactCount: 0,
  workspaceCanMove: false,
  ...extra,
});

const BRAND = directory("d-brand", {
  name: "Brand",
  workspaces: [{ id: "w-brand", name: "Brand Tracking" }],
  workspaceCanMove: true,
});
const US = directory("d-us", {
  name: "Northwind US",
  matchingKey: "externalId",
  workspaces: [{ id: "w-market", name: "Market Access" }],
  contactCount: 6120,
});

const LIST: TContactDirectoryList = {
  directories: [BRAND, US],
  workspaces: [
    { id: "w-brand", name: "Brand Tracking", directoryId: "d-brand" },
    { id: "w-hcp", name: "HCP Relationship", directoryId: null },
    { id: "w-market", name: "Market Access", directoryId: "d-us" },
  ],
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": status < 400 ? "application/json" : "application/problem+json" },
  });

const renderDialog = (props: { directory?: TContactDirectory; onClose?: () => void } = {}) => {
  const onClose = props.onClose ?? vi.fn();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <ContactDirectoryDialog
        organizationId={ORG_ID}
        list={LIST}
        directory={props.directory}
        onClose={onClose}
      />
    </QueryClientProvider>
  );
  return { onClose };
};

const dialog = () => within(screen.getByRole("dialog"));

/**
 * The picker hands its selection to the form in a microtask, so each pick or removal waits for it, as a
 * person's next click would.
 */
const settle = () => act(async () => await Promise.resolve());

/** Opens the workspace picker and picks the row with this label. */
const pick = async (label: string) => {
  fireEvent.focus(dialog().getByPlaceholderText(`${K}.select_workspaces_placeholder`));
  fireEvent.click(dialog().getByText(label));
  await settle();
};

const submit = (name: RegExp | string) => fireEvent.click(dialog().getByRole("button", { name }));

const requests = (method: string) =>
  vi.mocked(global.fetch).mock.calls.filter(([, init]) => (init?.method ?? "GET") === method);

describe("ContactDirectoryDialog", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "POST") return json({ data: BRAND }, 201);
        if (init?.method === "PATCH") return json({ data: BRAND });
        if (String(input) === LIST_URL) return json({ data: LIST });
        throw new Error(`Unexpected request ${String(input)}`);
      })
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  test("greys out a workspace that can't move, naming its directory, and won't pick it", async () => {
    renderDialog();

    fireEvent.focus(dialog().getByPlaceholderText(`${K}.select_workspaces_placeholder`));
    expect(
      dialog().getByText(`${K}.workspace_uses_directory {"directoryName":"Northwind US"}`)
    ).toBeInTheDocument();
    fireEvent.click(dialog().getByText("Market Access"));
    await settle();

    expect(
      dialog().queryByRole("button", { name: 'common.remove_item {"item":"Market Access"}' })
    ).toBeNull();
  });

  test("shows the shared-contacts line once two workspaces are picked", async () => {
    renderDialog();

    await pick("Brand Tracking");
    expect(dialog().queryByText(`${K}.shared_contacts_note`)).toBeNull();
    await pick("HCP Relationship");
    expect(dialog().getByText(`${K}.shared_contacts_note`)).toBeInTheDocument();
  });

  test("asks for a name before creating a directory with one workspace", async () => {
    renderDialog();

    await pick("Brand Tracking");
    submit(`${K}.create_directory`);

    expect(await dialog().findByText(`${K}.error_name_required`)).toBeInTheDocument();
    expect(requests("POST")).toHaveLength(0);
  });

  test("won't save a directory whose name was cleared", async () => {
    renderDialog({ directory: BRAND });

    fireEvent.change(dialog().getByLabelText("common.name"), { target: { value: "   " } });
    submit("common.save");

    expect(await dialog().findByText(`${K}.error_name_required`)).toBeInTheDocument();
    expect(requests("PATCH")).toHaveLength(0);
  });

  test("creates an external-ID directory with the picked workspaces and closes", async () => {
    const { onClose } = renderDialog();

    fireEvent.change(dialog().getByLabelText("common.name"), { target: { value: " Northwind EU " } });
    fireEvent.click(dialog().getByLabelText(`${K}.external_id`));
    await pick("Brand Tracking");
    await pick("HCP Relationship");
    submit(`${K}.create_directory`);

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const [url, init] = requests("POST")[0];
    expect(String(url)).toBe(LIST_URL);
    expect(JSON.parse(String(init?.body))).toEqual({
      name: "Northwind EU",
      matchingKey: "externalId",
      workspaceIds: ["w-brand", "w-hcp"],
    });
    expect(toast.success).toHaveBeenCalledWith(`${K}.directory_created`);
  });

  test("manages a directory: its name is filled in and the matching key is fixed", () => {
    renderDialog({ directory: BRAND });

    expect(dialog().getByLabelText("common.name")).toHaveValue("Brand");
    expect(dialog().getByLabelText("common.email")).toBeDisabled();
    expect(dialog().getByLabelText(`${K}.external_id`)).toBeDisabled();
  });

  // Decision 8: a workspace can't leave the directory it uses, so its chip can't be removed.
  test("locks the directory's own workspaces and says why", async () => {
    renderDialog({ directory: BRAND });

    expect(dialog().getByText(`${K}.workspaces_stay_note`)).toBeInTheDocument();
    expect(
      dialog().queryByRole("button", { name: 'common.remove_item {"item":"Brand Tracking"}' })
    ).toBeNull();

    // A workspace added now can still be taken out before saving; Backspace skips the locked chip.
    await pick("HCP Relationship");
    const hcpChipRemove = { name: 'common.remove_item {"item":"HCP Relationship"}' };
    expect(dialog().getByRole("button", hcpChipRemove)).toBeInTheDocument();
    const input = dialog().getByPlaceholderText(`${K}.select_workspaces_placeholder`);
    fireEvent.keyDown(input, { key: "Backspace" });
    await settle();
    fireEvent.keyDown(input, { key: "Backspace" });
    await settle();

    expect(dialog().queryByRole("button", hcpChipRemove)).toBeNull();
    expect(dialog().getByText("Brand Tracking")).toBeInTheDocument();
    expect(dialog().queryByText(`${K}.error_workspace_cannot_leave`)).toBeNull();
  });

  // Decision 8: Brand Tracking's directory is empty, so picking it moves it here and deletes that directory.
  test("says when picking a workspace moves it here and deletes its empty directory", async () => {
    renderDialog({ directory: US });

    fireEvent.focus(dialog().getByPlaceholderText(`${K}.select_workspaces_placeholder`));
    expect(dialog().getByText(`${K}.workspace_moves_here {"directoryName":"Brand"}`)).toBeInTheDocument();
    fireEvent.click(dialog().getByText("Brand Tracking"));
    await settle();
    await pick("HCP Relationship");

    expect(
      dialog()
        .getAllByText(/saving_moves_workspace/)
        .map((note) => note.textContent)
    ).toEqual([`${K}.saving_moves_workspace {"workspaceName":"Brand Tracking","directoryName":"Brand"}`]);
  });

  test("says a workspace stays once a workspace is picked for a new directory", async () => {
    renderDialog();

    expect(dialog().queryByText(`${K}.workspaces_stay_note`)).toBeNull();
    await pick("Brand Tracking");
    expect(dialog().getByText(`${K}.workspaces_stay_note`)).toBeInTheDocument();
    expect(
      dialog().getByRole("button", { name: 'common.remove_item {"item":"Brand Tracking"}' })
    ).toBeInTheDocument();
  });

  test("shows a taken name on the name field", async () => {
    vi.mocked(global.fetch).mockImplementation(async (_input, init) =>
      init?.method === "PATCH"
        ? json({ status: 409, detail: "taken", code: "contact_directory_name_taken", requestId: "r" }, 409)
        : json({ data: LIST })
    );
    renderDialog({ directory: BRAND });

    fireEvent.change(dialog().getByLabelText("common.name"), { target: { value: "Northwind US" } });
    submit("common.save");

    expect(await dialog().findByText(`${K}.error_name_taken`)).toBeInTheDocument();
    expect(JSON.parse(String(requests("PATCH")[0][1]?.body))).toEqual({
      name: "Northwind US",
      workspaceIds: ["w-brand"],
    });
  });
});
