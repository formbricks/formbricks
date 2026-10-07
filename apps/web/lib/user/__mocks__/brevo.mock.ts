import { vi } from "vitest";

vi.mock("@/modules/auth/lib/brevo", () => ({
  deleteBrevoCustomerByEmail: vi.fn(),
}));
