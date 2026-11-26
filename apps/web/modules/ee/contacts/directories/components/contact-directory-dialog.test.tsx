import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import toast from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { TContactDirectory, TContactDirectoryList } from "../types";
import { ContactDirectoryDialog } from "./contact-directory-dialog";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) => (values ? `${key} ${JSON.stringify(values)}` : key),
    i18n: { language: "en-US" },
  }),
}));

const ORG_ID = "clorg11111111111111111111";
const LIST_URL = `/api/internal/contact-directories?organizationId=${ORG_ID}`;
const K = "workspace.settings.contact_directories";

const directory = (id: string, extra: Partial<TContactDirectory>): TContactDirectory => ({
  id,
  name: id,
  matchingKey: "email",
  isArchived: false,
  workspaces: [],
  contactCount: 0,
  ...extra,
});

const BRAND = directory("d-brand", {
  name: "Brand",
  workspaces: [{ id: "w-brand", name: "Brand Tracking" }],
});
const US = directory("d-us", {
  name: "Northwind US",
  matchingKey: "userId",
  workspaces: [
    { id: "w-market", name: "Market Access" },
    { id: "w-field", name: "Field Sales" },
  ],
  contactCount: 6120,
});
const OLD = directory("d-old", { name: "Old EU", isArchived: true });

const LIST: TContactDirectoryList = {
  directories: [BRAND, US, OLD],
  workspaces: [
    { id: "w-brand", name: "Brand Tracking", directoryId: "d-brand" },
    { id: "w-field", name: "Field Sales", directoryId: "d-us" },
    { id: "w-hcp", name: "HCP Relationship", directoryId: null },
    { id: "w-market", name: "Market Access", directoryId: "d-us" },
  ],
};

const TARGETED = {
  workspaces: [
    {
      workspaceId: "w-market",
      surveys: [
        { id: "s1", name: "Onboarding NPS", status: "inProgress" },
        { id: "s2", name: "Launch poll", status: "scheduled" },
      ],
      // The route lists only the first surveys of a workspace with many.
      totalCount: 5,
    },
    { workspaceId: "w-field", surveys: [], totalCount: 0 },
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
        if (String(input).endsWith("/targeted-surveys")) return json({ data: TARGETED });
        throw new Error(`Unexpected request ${String(input)}`);
      })
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  // Decision 3: joining never moves a workspace out of another directory.
  test("greys out a workspace in another directory, naming it, and won't pick it", async () => {
    renderDialog();

    fireEvent.focus(dialog().getByPlaceholderText(`${K}.select_workspaces_placeholder`));
    expect(dialog().getByText(`${K}.workspace_in_directory {"directoryName":"Brand"}`)).toBeInTheDocument();
    fireEvent.click(dialog().getByText("Brand Tracking"));
    await settle();

    expect(
      dialog().queryByRole("button", { name: 'common.remove_item {"item":"Brand Tracking"}' })
    ).toBeNull();
  });

  // Review point 6: the help sits under the label.
  test("explains the matching key under its label when creating", () => {
    renderDialog();

    expect(dialog().getByText(`${K}.matching_key_help`)).toBeInTheDocument();
  });

  test("shows the shared-contacts line for the directory's matching key once two workspaces are picked", async () => {
    renderDialog({ directory: BRAND });

    expect(dialog().queryByText(`${K}.shared_contacts_note_email`)).toBeNull();
    await pick("HCP Relationship");
    expect(dialog().getByText(`${K}.shared_contacts_note_email`)).toBeInTheDocument();
    cleanup();

    renderDialog({ directory: US });
    expect(dialog().getByText(`${K}.shared_contacts_note_user_id`)).toBeInTheDocument();
  });

  test("asks for a name before creating a directory with one workspace", async () => {
    renderDialog();

    await pick("HCP Relationship");
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

  test("creates a User ID directory with the picked workspace and closes", async () => {
    const { onClose } = renderDialog();

    fireEvent.change(dialog().getByLabelText("common.name"), { target: { value: " Northwind EU " } });
    fireEvent.click(dialog().getByLabelText("common.user_id"));
    await pick("HCP Relationship");
    submit(`${K}.create_directory`);

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const [url, init] = requests("POST")[0];
    expect(String(url)).toBe(LIST_URL);
    expect(JSON.parse(String(init?.body))).toEqual({
      name: "Northwind EU",
      matchingKey: "userId",
      workspaceIds: ["w-hcp"],
    });
    expect(toast.success).toHaveBeenCalledWith(`${K}.directory_created`);
  });

  // Review point 7: the fixed key is text, not a disabled toggle.
  test("manages a directory: its name is filled in and the matching key is read-only text", () => {
    renderDialog({ directory: US });

    expect(dialog().getByLabelText("common.name")).toHaveValue("Northwind US");
    expect(dialog().getByText(`${K}.matches_contacts_by_user_id`)).toBeInTheDocument();
    expect(dialog().queryByLabelText("common.email")).toBeNull();
  });

  // As Feedback directories do: the id, with a copy button, for API and support use.
  test("shows the directory's id when managing it, and none while creating one", () => {
    renderDialog({ directory: BRAND });
    expect(dialog().getByText(`${K}.directory_id`)).toBeInTheDocument();
    expect(dialog().getByText(BRAND.id)).toBeInTheDocument();
    cleanup();

    renderDialog();
    expect(dialog().queryByText(`${K}.directory_id`)).toBeNull();
  });

  // Decision 2: removing a workspace is confirmed on Save, with its surveys and a ticked pause box.
  test("confirms a removal with the workspace's targeted surveys, and pauses them by default", async () => {
    const { onClose } = renderDialog({ directory: US });

    fireEvent.click(dialog().getByRole("button", { name: 'common.remove_item {"item":"Market Access"}' }));
    await settle();
    submit("common.save");

    const confirm = within(await screen.findByRole("dialog", { name: /remove_workspaces_title/ }));
    expect(
      confirm.getByText(
        `${K}.remove_workspaces_title {"workspaceNames":"Market Access","directoryName":"Northwind US"}`
      )
    ).toBeInTheDocument();
    expect(await confirm.findByText("Onboarding NPS")).toBeInTheDocument();
    expect(confirm.getByText("Launch poll")).toBeInTheDocument();
    expect(confirm.getByText(`${K}.targeted_surveys_more {"count":3}`)).toBeInTheDocument();
    expect(confirm.getByRole("checkbox", { name: `${K}.pause_these_surveys` })).toBeChecked();
    expect(requests("PATCH")).toHaveLength(0);

    fireEvent.click(confirm.getByRole("button", { name: `${K}.remove_workspaces` }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(JSON.parse(String(requests("PATCH")[0][1]?.body))).toEqual({
      name: "Northwind US",
      workspaceIds: ["w-field"],
      pauseSurveysInWorkspaceIds: ["w-market"],
    });
  });

  test("keeps the surveys running when the pause box is unticked", async () => {
    renderDialog({ directory: US });

    fireEvent.click(dialog().getByRole("button", { name: 'common.remove_item {"item":"Market Access"}' }));
    await settle();
    submit("common.save");
    const checkbox = await screen.findByRole("checkbox", { name: `${K}.pause_these_surveys` });
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole("button", { name: `${K}.remove_workspaces` }));

    await waitFor(() => expect(requests("PATCH")).toHaveLength(1));
    expect(JSON.parse(String(requests("PATCH")[0][1]?.body))).toEqual({
      name: "Northwind US",
      workspaceIds: ["w-field"],
    });
  });

  /** Removes Brand's only workspace, saves, and waits for the confirm step to load its surveys. */
  const removeLastWorkspace = async () => {
    renderDialog({ directory: BRAND });
    fireEvent.click(dialog().getByRole("button", { name: 'common.remove_item {"item":"Brand Tracking"}' }));
    await settle();
    submit("common.save");
    const confirm = within(await screen.findByRole("dialog", { name: /remove_workspaces_title/ }));
    await confirm.findByText(`${K}.no_targeted_surveys`);
    return confirm;
  };

  // ADR 0062: removing the last workspace only detaches it; "Also archive" is an unticked shortcut that
  // sends the Archive button's own request after the removal is saved.
  test("keeps the directory active when its last workspace is removed and the archive box stays unticked", async () => {
    const confirm = await removeLastWorkspace();

    expect(
      confirm.getByText(
        `${K}.remove_workspaces_title {"workspaceNames":"Brand Tracking","directoryName":"Brand"}`
      )
    ).toBeInTheDocument();
    expect(confirm.getByRole("checkbox", { name: `${K}.also_archive_directory` })).not.toBeChecked();
    fireEvent.click(confirm.getByRole("button", { name: `${K}.remove_workspaces` }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(`${K}.directory_updated`));
    expect(requests("PATCH")).toHaveLength(1);
    expect(JSON.parse(String(requests("PATCH")[0][1]?.body))).toEqual({ name: "Brand", workspaceIds: [] });
  });

  test("archives in a second request after the removal when the archive box is ticked", async () => {
    const confirm = await removeLastWorkspace();

    fireEvent.click(confirm.getByRole("checkbox", { name: `${K}.also_archive_directory` }));
    fireEvent.click(confirm.getByRole("button", { name: `${K}.remove_workspaces` }));

    await waitFor(() => expect(requests("PATCH")).toHaveLength(2));
    expect(JSON.parse(String(requests("PATCH")[0][1]?.body))).toEqual({ name: "Brand", workspaceIds: [] });
    expect(JSON.parse(String(requests("PATCH")[1][1]?.body))).toEqual({ isArchived: true });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(`${K}.directory_archived`));
  });

  test("offers no archive box when other workspaces stay", async () => {
    renderDialog({ directory: US });

    fireEvent.click(dialog().getByRole("button", { name: 'common.remove_item {"item":"Market Access"}' }));
    await settle();
    submit("common.save");

    const confirm = within(await screen.findByRole("dialog", { name: /remove_workspaces_title/ }));
    await confirm.findByText("Onboarding NPS");
    expect(confirm.queryByRole("checkbox", { name: `${K}.also_archive_directory` })).toBeNull();
  });

  // ADR 0062: unarchiving needs no workspace, and can add some in the same save.
  test("unarchives a directory without a workspace", async () => {
    const { onClose } = renderDialog({ directory: OLD });

    submit("common.unarchive");

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(JSON.parse(String(requests("PATCH")[0][1]?.body))).toEqual({
      name: "Old EU",
      workspaceIds: [],
      isArchived: false,
    });
    expect(toast.success).toHaveBeenCalledWith(`${K}.directory_unarchived`);
  });

  test("unarchives a directory together with a picked workspace", async () => {
    const { onClose } = renderDialog({ directory: OLD });

    await pick("HCP Relationship");
    submit("common.unarchive");

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(JSON.parse(String(requests("PATCH")[0][1]?.body))).toEqual({
      name: "Old EU",
      workspaceIds: ["w-hcp"],
      isArchived: false,
    });
  });

  test("offers Archive only for a directory with no workspaces", async () => {
    renderDialog({ directory: BRAND });

    const disabledArchive = dialog().getByRole("button", { name: `${K}.archive_directory` });
    expect(disabledArchive).toHaveAttribute("aria-disabled", "true");
    fireEvent.focus(disabledArchive);
    expect((await screen.findAllByText(`${K}.archive_needs_no_workspaces`)).length).toBeGreaterThan(0);
    fireEvent.click(disabledArchive);
    expect(requests("PATCH")).toHaveLength(0);
    cleanup();

    // An active directory left with no workspaces can be archived.
    const { onClose } = renderDialog({ directory: directory("d-empty", { name: "Empty" }) });
    const archive = dialog().getByRole("button", { name: `${K}.archive_directory` });
    expect(archive).not.toHaveAttribute("aria-disabled");
    fireEvent.focus(archive);
    expect(screen.queryByText(`${K}.archive_needs_no_workspaces`)).toBeNull();
    fireEvent.click(archive);

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(JSON.parse(String(requests("PATCH")[0][1]?.body))).toEqual({ isArchived: true });
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
