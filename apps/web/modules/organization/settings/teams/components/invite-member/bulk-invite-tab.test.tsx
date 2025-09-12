import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { BulkInviteTab } from "./bulk-invite-tab";

// Hoisted fns for mocks to avoid hoisting pitfalls
const h = vi.hoisted(() => ({
  mockParse: vi.fn(),
  mockToastError: vi.fn(),
}));

// Mocks
vi.mock("papaparse", () => ({
  default: { parse: h.mockParse },
}));

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({ t: (k: string) => k }),
}));

vi.mock("react-hot-toast", () => ({
  default: { error: h.mockToastError },
}));

vi.mock("@/modules/organization/settings/teams/types/invites", () => ({
  ZInvitees: { parse: vi.fn() },
}));

let lastUploaderProps: any;
vi.mock("@/modules/ui/components/file-input/components/uploader", () => ({
  Uploader: vi.fn((props: any) => {
    lastUploaderProps = props;
    return (
      <div data-testid="uploader-mock">
        <input data-testid="upload-file-input" />
      </div>
    );
  }),
}));

describe("BulkInviteTab", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    lastUploaderProps = undefined;
  });

  const baseProps = {
    setOpen: vi.fn(),
    onSubmit: vi.fn(),
    isAccessControlAllowed: true,
    isFormbricksCloud: true,
    isStorageConfigured: true,
  };

  test("renders Uploader with correct props", () => {
    render(<BulkInviteTab {...baseProps} />);
    expect(screen.getByTestId("uploader-mock")).toBeInTheDocument();
    expect(lastUploaderProps).toEqual(
      expect.objectContaining({
        allowedFileExtensions: ["csv"],
        id: "bulk-invite",
        name: "bulk-invite",
        multiple: false,
        disabled: false,
        isStorageConfigured: true,
      })
    );
  });

  test("selecting a CSV shows filename, disables uploader, enables import; removing clears it", async () => {
    render(<BulkInviteTab {...baseProps} />);
    const user = userEvent.setup();

    const file = new File(["name,email,role\nA,a@example.com,manager"], "people.csv", {
      type: "text/csv",
    });

    // Simulate upload via mocked Uploader
    lastUploaderProps.handleUpload([file]);
    // Filename visible
    expect(await screen.findByText("people.csv")).toBeInTheDocument();

    // Uploader should be disabled after selection (component re-renders)
    await waitFor(() => expect(lastUploaderProps.disabled).toBe(true));

    // Import button enabled
    const importButton = screen.getByRole("button", { name: /common.import/i });
    expect(importButton).toBeEnabled();

    // Remove file (icon-only button near filename)
    const nameEl = screen.getByText("people.csv");
    const container = nameEl.closest("div") as HTMLElement;
    const removeBtn = within(container).getByRole("button");
    await user.click(removeBtn);
    expect(screen.queryByText("people.csv")).not.toBeInTheDocument();
  });

  test("onImport parses CSV and calls onSubmit (access control allowed)", async () => {
    render(<BulkInviteTab {...baseProps} />);

    const file = new File(["dummy"], "people.csv", { type: "text/csv" });
    lastUploaderProps.handleUpload([file]);

    // Mock Papa.parse to synchronously call complete with parsed rows
    h.mockParse.mockImplementation((_file: File, opts: any) => {
      opts.complete({
        data: [
          { name: " Alice ", email: " alice@example.com ", role: " Manager " },
          { name: "Bob", email: "bob@example.com", role: "member" },
        ],
      });
    });

    const importButton = screen.getByRole("button", { name: /common.import/i });
    await userEvent.click(importButton);

    expect(baseProps.onSubmit).toHaveBeenCalledWith([
      { name: "Alice", email: "alice@example.com", role: "manager", teamIds: [] },
      { name: "Bob", email: "bob@example.com", role: "member", teamIds: [] },
    ]);
    expect(baseProps.setOpen).toHaveBeenCalledWith(false);
  });

  test("onImport forces owner when access control not allowed", async () => {
    const props = { ...baseProps, isAccessControlAllowed: false };
    render(<BulkInviteTab {...props} />);

    const file = new File(["dummy"], "people.csv", { type: "text/csv" });
    lastUploaderProps.handleUpload([file]);

    h.mockParse.mockImplementation((_file: File, opts: any) => {
      opts.complete({
        data: [{ name: "Carol", email: "carol@example.com", role: "admin" }],
      });
    });

    const importButton = screen.getByRole("button", { name: /common.import/i });
    await userEvent.click(importButton);

    expect(props.onSubmit).toHaveBeenCalledWith([
      { name: "Carol", email: "carol@example.com", role: "owner", teamIds: [] },
    ]);
  });

  test("onImport maps billing to owner when not Formbricks Cloud", async () => {
    const props = { ...baseProps, isFormbricksCloud: false };
    render(<BulkInviteTab {...props} />);

    const file = new File(["dummy"], "people.csv", { type: "text/csv" });
    lastUploaderProps.handleUpload([file]);

    h.mockParse.mockImplementation((_file: File, opts: any) => {
      opts.complete({
        data: [{ name: "Dave", email: "dave@example.com", role: "billing" }],
      });
    });

    const importButton = screen.getByRole("button", { name: /common.import/i });
    await userEvent.click(importButton);

    expect(props.onSubmit).toHaveBeenCalledWith([
      { name: "Dave", email: "dave@example.com", role: "owner", teamIds: [] },
    ]);
  });

  test("invalid drop file type shows toast error", async () => {
    render(<BulkInviteTab {...baseProps} />);

    // Call handleDrop with a non-csv file
    const evt = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      dataTransfer: { files: [new File(["x"], "image.png", { type: "image/png" })] },
    } as any;

    await lastUploaderProps.handleDrop(evt);
    expect(h.mockToastError).toHaveBeenCalled();
  });

  test("remove file button clears selection", async () => {
    render(<BulkInviteTab {...baseProps} />);
    const user = userEvent.setup();

    const file = new File(["x"], "people.csv", { type: "text/csv" });
    lastUploaderProps.handleUpload([file]);

    // Locate the container that shows filename and its button
    const nameEl = await screen.findByText("people.csv");
    const container = nameEl.closest("div") as HTMLElement;
    const removeButton = within(container).getByRole("button");
    await user.click(removeButton);

    expect(screen.queryByText("people.csv")).not.toBeInTheDocument();
  });
});
